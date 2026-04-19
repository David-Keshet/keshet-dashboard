const http = require('http');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZTdhOGU3NS0xNWMzLTRhYjctYmUyNS1mYmRhMTIzOTQ1ZmUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNmI5MTI5MDUtNjRmZC00MjM4LTgwZGMtMjVkOGExNGIzNjkyIiwiaWF0IjoxNzc2MzgzNDk2fQ.UEr4KDYGWosc4_hYECjO6b-UWuhaAMicLHfJKZbWUOI';
const ANTHROPIC_CRED_ID = 'n2mNxVQQltadaaKM';
const TELEGRAM_CRED_ID = 'qil7d2FsndYXZqBV';
const BOT_TOKEN = '8743149734:AAFHHhfvBR9jlUL-8YlOLgYTqNaHxq86gNc';

const PROMPTS_DIR = 'C:\\Users\\\u05de\u05e9\u05e8\u05d3 \u05d3\u05d5\u05d3\\Desktop\\\u05de\u05e2\u05e8\u05db\u05ea \u05de\u05e2\u05e0\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\\n8n-scripts\\prompts';
const SYNC_SCRIPT = 'C:\\Users\\\u05de\u05e9\u05e8\u05d3 \u05d3\u05d5\u05d3\\Desktop\\\u05de\u05e2\u05e8\u05db\u05ea \u05de\u05e2\u05e0\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\\n8n-scripts\\sync-to-n8n.js';
const OFFSET_FILE = 'C:\\Users\\\u05de\u05e9\u05e8\u05d3 \u05d3\u05d5\u05d3\\Desktop\\\u05de\u05e2\u05e8\u05db\u05ea \u05de\u05e2\u05e0\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9\\n8n-scripts\\.telegram_offset';

// Build code strings using variables to avoid escaping issues
const pollCode = [
  "const https = require('https');",
  "const fs = require('fs');",
  "",
  "const BOT_TOKEN = " + JSON.stringify(BOT_TOKEN) + ";",
  "const PROMPTS_DIR = " + JSON.stringify(PROMPTS_DIR) + ";",
  "const OFFSET_FILE = " + JSON.stringify(OFFSET_FILE) + ";",
  "",
  "function httpsGet(url) {",
  "  return new Promise((resolve, reject) => {",
  "    https.get(url, res => {",
  "      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));",
  "    }).on('error', reject);",
  "  });",
  "}",
  "",
  "let offset = 0;",
  "try { offset = parseInt(fs.readFileSync(OFFSET_FILE, 'utf8').trim()) || 0; } catch(e) {}",
  "",
  "const updates = await httpsGet('https://api.telegram.org/bot' + BOT_TOKEN + '/getUpdates?offset=' + offset + '&timeout=1&limit=1');",
  "",
  "if (!updates.ok || !updates.result || !updates.result.length) {",
  "  return [];",
  "}",
  "",
  "const update = updates.result[0];",
  "fs.writeFileSync(OFFSET_FILE, String(update.update_id + 1), 'utf8');",
  "",
  "const msg = update.message;",
  "if (!msg || !msg.text) return [];",
  "",
  "// Read prompt files",
  "let filesSummary = '';",
  "try {",
  "  const fileList = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.txt')).sort();",
  "  const parts = fileList.map(f => {",
  "    const content = fs.readFileSync(PROMPTS_DIR + '\\\\' + f, 'utf8');",
  "    return f + ':\\n' + content;",
  "  });",
  "  filesSummary = parts.join('\\n\\n---\\n\\n');",
  "} catch(e) { filesSummary = '(error reading files: ' + e.message + ')'; }",
  "",
  "const systemPrompt = 'You are an assistant managing the N8N automation system for Keshet Print Shop.\\n' +",
  "  'The user can ask to update prices, products, rules, or text in the prompt files.\\n\\n' +",
  "  'Available prompt files:\\n' + filesSummary + '\\n\\n' +",
  "  'Return ONLY valid JSON (no markdown):\\n' +",
  "  '{\"file\": \"02_quote_agent.txt\", \"content\": \"...full updated content...\", \"summary\": \"קצר בעברית\"}\\n\\n' +",
  "  'If unclear: {\"file\": null, \"content\": null, \"summary\": \"לא הבנתי — נסה שוב\"}';",
  "",
  "return [{ json: { chatId: msg.chat.id, userText: msg.text, system_prompt: systemPrompt } }];"
].join('\n');

const writeCode = [
  "const https = require('https');",
  "const fs = require('fs');",
  "const { execSync } = require('child_process');",
  "",
  "const BOT_TOKEN = " + JSON.stringify(BOT_TOKEN) + ";",
  "const PROMPTS_DIR = " + JSON.stringify(PROMPTS_DIR) + ";",
  "const SYNC_SCRIPT = " + JSON.stringify(SYNC_SCRIPT) + ";",
  "",
  "const chatId = $('Poll Telegram').first().json.chatId;",
  "const aiOutput = $input.first().json.text || $input.first().json.output || '';",
  "",
  "function sendMsg(text) {",
  "  return new Promise(resolve => {",
  "    https.get('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage?chat_id=' + chatId + '&text=' + encodeURIComponent(text),",
  "      res => { res.resume(); res.on('end', resolve); }).on('error', () => resolve());",
  "  });",
  "}",
  "",
  "let parsed;",
  "try {",
  "  parsed = JSON.parse(aiOutput.replace(/```json|```/g, '').trim());",
  "} catch(e) {",
  "  await sendMsg('\u274c \u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05e4\u05e2\u05e0\u05d5\u05d7 \u05ea\u05e9\u05d5\u05d1\u05ea AI');",
  "  return [{ json: { success: false } }];",
  "}",
  "",
  "if (!parsed.file || !parsed.content) {",
  "  await sendMsg('\u26a0\ufe0f ' + (parsed.summary || '\u05dc\u05d0 \u05d1\u05d5\u05e6\u05e2 \u05e9\u05d9\u05e0\u05d5\u05d9'));",
  "  return [{ json: { success: false, summary: parsed.summary } }];",
  "}",
  "",
  "fs.writeFileSync(PROMPTS_DIR + '\\\\' + parsed.file, parsed.content, 'utf8');",
  "",
  "try {",
  "  execSync('node \"' + SYNC_SCRIPT + '\"', { timeout: 30000, stdio: 'pipe' });",
  "} catch(e) {",
  "  await sendMsg('\u26a0\ufe0f \u05d4\u05e7\u05d5\u05d1\u05e5 \u05e2\u05d5\u05d3\u05db\u05df \u05d0\u05d1\u05dc \u05d4\u05e1\u05e0\u05db\u05e8\u05d5\u05df \u05e0\u05db\u05e9\u05dc: ' + e.message.slice(0, 100));",
  "  return [{ json: { success: false } }];",
  "}",
  "",
  "await sendMsg('\u2705 \u05e2\u05d5\u05d3\u05db\u05df!\\n' + parsed.summary);",
  "return [{ json: { success: true, file: parsed.file, summary: parsed.summary } }];"
].join('\n');

const workflow = {
  name: 'Telegram AI Assistant',
  nodes: [
    {
      id: 'schedule-trigger',
      name: 'Poll Every 10s',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.2,
      position: [120, 300],
      parameters: {
        rule: { interval: [{ field: 'seconds', secondsInterval: 10 }] }
      }
    },
    {
      id: 'poll-telegram',
      name: 'Poll Telegram',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [360, 300],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: pollCode
      }
    },
    {
      id: 'claude-model',
      name: 'Claude Model',
      type: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      typeVersion: 1.3,
      position: [600, 480],
      credentials: { anthropicApi: { id: ANTHROPIC_CRED_ID, name: 'Anthropic account' } },
      parameters: { model: 'claude-sonnet-4-6', options: {} }
    },
    {
      id: 'ai-chain',
      name: 'AI Chain',
      type: '@n8n/n8n-nodes-langchain.chainLlm',
      typeVersion: 1.4,
      position: [600, 300],
      parameters: {
        prompt: '={{ $json.system_prompt + "\\n\\nUser request: " + $json.userText }}'
      }
    },
    {
      id: 'write-sync-reply',
      name: 'Write + Sync + Reply',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [840, 300],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: writeCode
      }
    }
  ],
  connections: {
    'Poll Every 10s': {
      main: [[{ node: 'Poll Telegram', type: 'main', index: 0 }]]
    },
    'Poll Telegram': {
      main: [[{ node: 'AI Chain', type: 'main', index: 0 }]]
    },
    'AI Chain': {
      main: [[{ node: 'Write + Sync + Reply', type: 'main', index: 0 }]]
    },
    'Claude Model': {
      ai_languageModel: [[{ node: 'AI Chain', type: 'ai_languageModel', index: 0 }]]
    }
  },
  settings: { executionOrder: 'v1' }
};

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost', port: 5678,
      path: '/api/v1' + path, method,
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Creating Telegram AI Assistant workflow...');
  const res = await apiRequest('POST', '/workflows', workflow);
  if (res.status === 200 || res.status === 201) {
    const id = res.data.id;
    console.log('\u2705 Workflow created! ID:', id);
    const act = await apiRequest('POST', `/workflows/${id}/activate`, {});
    if (act.status === 200) {
      console.log('\u2705 Workflow activated! Polls Telegram every 10 seconds.');
      console.log('Open N8N to verify: http://localhost:5678');
    } else {
      console.log('\u26a0\ufe0f Activate returned:', act.status, JSON.stringify(act.data).slice(0, 300));
      console.log('Activate manually in N8N UI: http://localhost:5678');
    }
  } else {
    console.error('\u274c Error creating workflow:', res.status);
    console.error(JSON.stringify(res.data, null, 2));
  }
}

main().catch(console.error);
