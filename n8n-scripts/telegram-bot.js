const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ===== CONFIG =====
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const POLL_INTERVAL = 5000;

if (!BOT_TOKEN || !ANTHROPIC_KEY) {
  console.error('❌ שגיאה: צריך להגדיר environment variables:');
  console.error('   TELEGRAM_BOT_TOKEN');
  console.error('   ANTHROPIC_API_KEY');
  console.error('\nדוגמה: set TELEGRAM_BOT_TOKEN=your_token && node telegram-bot.js');
  process.exit(1);
}

const BASE_DIR = path.join(__dirname);
const PROMPTS_DIR = path.join(BASE_DIR, 'prompts');
const SYNC_SCRIPT = path.join(BASE_DIR, 'sync-to-n8n.js');
const OFFSET_FILE = path.join(BASE_DIR, '.telegram_offset');
// ==================

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    }).on('error', reject);
  });
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(text)}`;
  return httpsGet(url).catch(() => {});
}

async function askClaude(systemPrompt, userMessage) {
  const res = await httpsPost('api.anthropic.com', '/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  }, {
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01'
  });
  return res.content?.[0]?.text || '';
}

function readPromptFiles() {
  const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.txt')).sort();
  return files.map(f => {
    const content = fs.readFileSync(path.join(PROMPTS_DIR, f), 'utf8');
    return `${f}:\n${content}`;
  }).join('\n\n---\n\n');
}

async function handleMessage(chatId, userText) {
  await sendTelegram(chatId, '⏳ מעבד את הבקשה...');

  let filesContent;
  try {
    filesContent = readPromptFiles();
  } catch(e) {
    await sendTelegram(chatId, '❌ שגיאה בקריאת קבצים: ' + e.message);
    return;
  }

  const systemPrompt =
    'You are an assistant managing the N8N automation system for Keshet Print Shop.\n' +
    'The user can ask to update prices, products, rules, or any text in the prompt files.\n\n' +
    'Available prompt files:\n' + filesContent + '\n\n' +
    'Return ONLY valid JSON — no markdown, no explanation:\n' +
    '{"file": "02_quote_agent.txt", "content": "...full updated file content...", "summary": "קצר בעברית מה שינית"}\n\n' +
    'If the request is unclear or cannot be applied safely:\n' +
    '{"file": null, "content": null, "summary": "לא הבנתי — נסה לנסח מחדש"}';

  let aiResponse;
  try {
    aiResponse = await askClaude(systemPrompt, userText);
  } catch(e) {
    await sendTelegram(chatId, '❌ שגיאה בחיבור ל-Claude: ' + e.message);
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(aiResponse.replace(/```json|```/g, '').trim());
  } catch(e) {
    await sendTelegram(chatId, '❌ Claude החזיר תשובה לא תקינה:\n' + aiResponse.slice(0, 200));
    return;
  }

  if (!parsed.file || !parsed.content) {
    await sendTelegram(chatId, '⚠️ ' + (parsed.summary || 'לא בוצע שינוי'));
    return;
  }

  try {
    fs.writeFileSync(path.join(PROMPTS_DIR, parsed.file), parsed.content, 'utf8');
  } catch(e) {
    await sendTelegram(chatId, '❌ שגיאה בכתיבת קובץ: ' + e.message);
    return;
  }

  try {
    execSync(`node "${SYNC_SCRIPT}"`, { timeout: 30000, stdio: 'pipe' });
  } catch(e) {
    await sendTelegram(chatId, '⚠️ הקובץ עודכן אבל הסנכרון נכשל:\n' + e.message.slice(0, 150));
    return;
  }

  await sendTelegram(chatId, '✅ עודכן!\n' + parsed.summary);
}

async function poll() {
  let offset = 0;
  try { offset = parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch(e) {}

  console.log(`[${new Date().toLocaleTimeString('he-IL')}] בוט פעיל — מאזין להודעות...`);

  while (true) {
    try {
      const updates = await httpsGet(
        `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=10&limit=10`
      );

      if (updates.ok && updates.result?.length) {
        for (const update of updates.result) {
          offset = update.update_id + 1;
          fs.writeFileSync(OFFSET_FILE, String(offset), 'utf8');

          const msg = update.message;
          if (!msg?.text) continue;

          const chatId = msg.chat.id;
          const text = msg.text;

          if (text === '/start') {
            await sendTelegram(chatId,
              '👋 שלום!\n\n' +
              'אני הבוט של דפוס קשת.\n' +
              'שלח לי הוראה לעדכון, למשל:\n\n' +
              '• "תעלה את מחיר 100 כרטיסי ביקור ל-120 ש"ח"\n' +
              '• "תוסיף מוצר: גלגיל PVC ב-400 ש"ח למ"ר"\n' +
              '• "תשנה את הטיפ לשמשונית"'
            );
            continue;
          }

          console.log(`[${new Date().toLocaleTimeString('he-IL')}] הודעה מ-${msg.from?.first_name}: ${text}`);
          handleMessage(chatId, text).catch(e => console.error('שגיאה:', e.message));
        }
      }
    } catch(e) {
      console.error(`[${new Date().toLocaleTimeString('he-IL')}] שגיאת חיבור:`, e.message);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

poll();
