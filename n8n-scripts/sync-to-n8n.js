/**
 * סקריפט סנכרון: קורא את קבצי ה-prompts ומעדכן את ה-workflow ב-N8N
 * הרצה: node sync-to-n8n.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ========== הגדרות ==========
const N8N_URL = 'http://localhost:5678';
const WORKFLOW_ID = '1sldbqqkyCqT07wy';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZTdhOGU3NS0xNWMzLTRhYjctYmUyNS1mYmRhMTIzOTQ1ZmUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNmI5MTI5MDUtNjRmZC00MjM4LTgwZGMtMjVkOGExNGIzNjkyIiwiaWF0IjoxNzc2MzgzNDk2fQ.UEr4KDYGWosc4_hYECjO6b-UWuhaAMicLHfJKZbWUOI';
// ============================

const PROMPTS_DIR = path.join(__dirname, 'prompts');
const TEMPLATES_DIR = path.join(__dirname, 'templates');

function readPrompt(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf8').trim();
}

function readTemplate(filename) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf8').trim();
}

async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_URL + endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || 5678,
      path: url.pathname + url.search,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function syncPrompts() {
  console.log('📖 קורא קבצי prompts...');

  const quoteBuilderCode = fs.readFileSync(path.join(__dirname, 'code', 'quote_html_builder.js'), 'utf8');

  const prompts = {
    classification: readPrompt('01_classification_agent.txt'),
    quote:          readPrompt('02_quote_agent.txt'),
    businessInfo:   readPrompt('03_business_info.txt'),
    orderConfirm:   readPrompt('04_order_confirmation.txt'),
    orderStatus:    readPrompt('05_order_status.txt'),
    supplier:       readPrompt('06_supplier_invoice.txt'),
    fallback:       readPrompt('07_unknown_fallback.txt'),
  };

  console.log('🔗 מתחבר ל-N8N...');
  const workflow = await apiRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);

  if (!workflow.nodes) {
    console.error('❌ שגיאה: לא ניתן לטעון את ה-workflow. בדוק את ה-API Key.');
    process.exit(1);
  }

  console.log(`✅ נטען workflow: "${workflow.name}" (${workflow.nodes.length} nodes)`);

  // מפה של שם node → שדה לעדכן
  const nodeUpdates = {
    'AI Agent ':      { field: 'options.systemMessage', value: prompts.classification },
    'AI Agent quote': { field: 'options.systemMessage', value: prompts.quote },
    'business_info':  { field: 'messages.messageValues[0].message', value: prompts.businessInfo },
    'order_confirmation': { field: 'messages.messageValues[0].message', value: prompts.orderConfirm },
    'order_status':   { field: 'messages.messageValues[0].message', value: prompts.orderStatus },
    'supplier_invoice':   { field: 'messages.messageValues[0].message', value: prompts.supplier },
    'לא יודע תשובה': { field: 'messages.messageValues[0].message', value: prompts.fallback },
  };

  let updatedCount = 0;

  workflow.nodes = workflow.nodes.map((node) => {
    // עדכון AI nodes (system messages / prompts)
    if (nodeUpdates[node.name]) {
      const update = nodeUpdates[node.name];
      const parts = update.field.split('.');

      if (parts[0] === 'options' && parts[1] === 'systemMessage') {
        node.parameters.options = node.parameters.options || {};
        node.parameters.options.systemMessage = update.value;
      } else if (parts[0] === 'messages') {
        node.parameters.messages = node.parameters.messages || { messageValues: [{}] };
        node.parameters.messages.messageValues[0] = node.parameters.messages.messageValues[0] || {};
        node.parameters.messages.messageValues[0].message = update.value;
      }

      console.log(`  ✏️  עדכון: ${node.name}`);
      updatedCount++;
    }

    // עדכון Code in JavaScript2 — בונה HTML מהתבנית
    if (node.name === 'Code in JavaScript2') {
      node.parameters.jsCode = quoteBuilderCode;
      console.log(`  ✏️  עדכון: Code in JavaScript2 (HTML builder)`);
      updatedCount++;
    }

    return node;
  });

  // מסיר שדות read-only שה-API לא מקבל
  const {
    id, createdAt, updatedAt, isArchived, activeVersionId,
    versionCounter, triggerCount, shared, activeVersion, active, versionId, meta, tags, ...workflowBody
  } = workflow;

  workflowBody.description = workflowBody.description ?? '';
  // מנקה שדות לא מורשים מ-settings
  const { binaryMode, ...cleanSettings } = workflowBody.settings || {};
  workflowBody.settings = cleanSettings;

  console.log(`\n🚀 שולח ${updatedCount} עדכונים ל-N8N...`);
  const result = await apiRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, workflowBody);

  if (result.id) {
    console.log('✅ הסנכרון הצליח! כל ה-prompts עודכנו ב-N8N.');
  } else {
    console.error('❌ שגיאה בשמירה:', JSON.stringify(result, null, 2));
  }
}

syncPrompts().catch((err) => {
  console.error('❌ שגיאה:', err.message);
});
