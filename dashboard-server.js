const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// N8N connection info
let N8N_URL = process.env.N8N_PUBLIC_URL || 'http://localhost:5678';

// Dashboard HTML
const DASHBOARD_FILE = path.join(__dirname, 'dashboard.html');
const QUOTE_TEMPLATE_FILE = path.join(__dirname, 'n8n-scripts/templates/quote_template.html');

console.log(`📊 Dashboard Server Starting...`);
console.log(`🔗 N8N URL: ${N8N_URL}`);

// ===== ROUTES =====

// Serve dashboard
app.get('/', (req, res) => {
  try {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');
    res.send(html);
  } catch(e) {
    res.status(500).send('Error loading dashboard: ' + e.message);
  }
});

// API: Get N8N workflows (to verify connection)
app.get('/api/n8n-status', async (req, res) => {
  try {
    const response = await axios.get(`${N8N_URL}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
    });
    res.json({
      status: 'connected',
      workflows: response.data.data ? response.data.data.length : 0,
      url: N8N_URL
    });
  } catch(e) {
    res.status(500).json({
      status: 'disconnected',
      error: e.message,
      url: N8N_URL
    });
  }
});

// API: Get conversations (mock data for now)
app.get('/api/conversations', (req, res) => {
  const conversations = [
    {
      id: 1,
      customer_name: 'דוד כהן',
      customer_email: 'david@example.com',
      quote_number: '#QT-2026-7731',
      message: 'שלום, אני צריך הצעת מחיר על 100 כרטיסי ביקור צד אחד',
      attachment: 'card_design.pdf (340 KB)',
      response: 'כרטיסי ביקור 100 יח׳ = 100 ₪ | כולל מע״מ: 118 ₪',
      status: 'quote_sent',
      timestamp: new Date(Date.now() - 2*60*60*1000).toISOString()
    },
    {
      id: 2,
      customer_name: 'עמית לוי',
      customer_email: 'amit@company.com',
      quote_number: '#QT-2026-7732',
      message: 'אני רוצה להדפיס פליירים 200 יח׳, A4 דו-צדדי',
      attachment: null,
      response: 'פליירים 200 יח׳ A4 דו-צדדי = 357 ₪ | כולל מע״מ: 421 ₪',
      status: 'confirmed',
      timestamp: new Date(Date.now() - 1*60*60*1000).toISOString()
    }
  ];
  res.json(conversations);
});

// API: Get order status
app.get('/api/orders/:order_id', async (req, res) => {
  const orderId = req.params.order_id;

  // This would connect to Trello/iCount in real implementation
  res.json({
    order_id: orderId,
    status: 'in_progress',
    stages: [
      { stage: 'חשבונית נוצרה', completed: true, timestamp: '15:10' },
      { stage: 'תשלום התקבל', completed: true, timestamp: '15:45' },
      { stage: 'כרטיס ב-Trello', completed: true, timestamp: '15:50' },
      { stage: 'בביצוע בדפוס', completed: false, timestamp: null }
    ]
  });
});

// Health check (for Railway)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Dashboard Server running on port ${PORT}`);
  console.log(`🌐 Access at: http://localhost:${PORT}`);
  console.log(`📊 N8N Status: ${N8N_URL}\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  process.exit(0);
});
