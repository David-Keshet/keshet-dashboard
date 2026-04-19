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
function getN8nUrl() {
  if (process.env.N8N_PUBLIC_URL) {
    return process.env.N8N_PUBLIC_URL.replace(/\/$/, '');
  }

  if (process.env.N8N_WEBHOOK_URL) {
    try {
      return new URL(process.env.N8N_WEBHOOK_URL).origin;
    } catch (e) {
      console.warn('Invalid N8N_WEBHOOK_URL, falling back to localhost:', e.message);
    }
  }

  return 'http://localhost:5678';
}

const N8N_URL = getN8nUrl();
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ||
  'http://localhost:5678/webhook/61e528a5-9b14-45d0-b8fa-c7157850feb4';

// Trello connection info
const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;

// Dashboard HTML
const DASHBOARD_FILE = path.join(__dirname, 'dashboard.html');
const QUOTE_TEMPLATE_FILE = path.join(__dirname, 'n8n-scripts/templates/quote_template.html');

console.log(`📊 Dashboard Server Starting...`);
console.log(`🔗 N8N URL: ${N8N_URL}`);
console.log(`🔗 N8N webhook URL: ${N8N_WEBHOOK_URL || 'not configured'}`);
console.log(`🔗 Trello configured: ${TRELLO_BOARD_ID ? 'yes' : 'no'}`);

// ===== ROUTES =====

const DATA_FILE = path.join(__dirname, 'live-data.json');

const defaultLiveData = {
  summary: {
    total_conversations: 0,
    pending_quotes: 0,
    approved_orders: 0,
    in_progress: 0,
    total_orders: 0,
    total_revenue: 0,
    average_order: 0,
    conversion_rate: 0,
    trello_status: 'not_configured'
  },
  conversations: [],
  orders: []
};

function loadLiveData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading live-data.json:', e.message);
  }
  return defaultLiveData;
}

function normalizeStatus(listName) {
  if (!listName) return 'quote';
  const lower = listName.toLowerCase();
  if (/confirmed|approved|מאושר|אושרה/.test(lower)) return 'confirmed';
  if (/progress|in progress|בביצוע|בעבודה/.test(lower)) return 'in_progress';
  if (/ready|done|completed|מוכן/.test(lower)) return 'ready';
  if (/delay|delayed|עיכוב/.test(lower)) return 'delayed';
  if (/quote|pending|הצעה/.test(lower)) return 'quote';
  return 'quote';
}

function parseAmount(text) {
  if (!text) return null;
  const match = text.match(/₪\s*([\d,.]+)/) || text.match(/([\d,.]+)\s*₪/);
  if (match) {
    return Number(match[1].replace(/,/g, '')) || null;
  }
  const digitMatch = text.match(/([\d,.]+)/);
  if (digitMatch) {
    return Number(digitMatch[1].replace(/,/g, '')) || null;
  }
  return null;
}

function mapTrelloCardToOrder(card, listName) {
  const amount = parseAmount(card.desc) || parseAmount(card.name) || 0;
  const quantityMatch = card.desc?.match(/(\d+)\s*(יח|pcs|pieces|כמות)/i);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  const timestampValue = card.due || card.dateLastActivity || new Date().toISOString();

  return {
    order_id: card.id,
    customer: card.name,
    product: card.name,
    quantity: quantity || 1,
    amount,
    status: normalizeStatus(listName),
    status_label: listName || 'לא ידוע',
    date: card.due ? new Date(card.due).toLocaleDateString('he-IL') : new Date(card.dateLastActivity).toLocaleDateString('he-IL'),
    timestamp: timestampValue,
    url: card.shortUrl,
    message: card.desc || ''
  };
}

async function fetchTrelloData() {
  if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
    return null;
  }

  const url = `https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists`;
  const params = {
    cards: 'open',
    card_fields: 'name,desc,due,dateLastActivity,shortUrl',
    fields: 'name',
    key: TRELLO_KEY,
    token: TRELLO_TOKEN
  };

  const response = await axios.get(url, { params });
  return response.data;
}

function buildTrelloSummary(lists) {
  const orders = [];
  let totalRevenue = 0;
  let approvedCount = 0;
  let inProgressCount = 0;
  let pendingCount = 0;

  lists.forEach((list) => {
    const listName = list.name;
    const status = normalizeStatus(listName);

    list.cards.forEach((card) => {
      const order = mapTrelloCardToOrder(card, listName);
      orders.push(order);
      totalRevenue += order.amount || 0;

      if (status === 'confirmed' || status === 'ready') approvedCount += 1;
      if (status === 'in_progress') inProgressCount += 1;
      if (status === 'quote') pendingCount += 1;
    });
  });

  const totalOrders = orders.length;
  const conversionRate = totalOrders > 0 ? Math.round((approvedCount / totalOrders) * 100) : 0;
  const averageOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  return {
    summary: {
      total_conversations: totalOrders,
      pending_quotes: pendingCount,
      approved_orders: approvedCount,
      in_progress: inProgressCount,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      average_order: averageOrder,
      conversion_rate: conversionRate,
      trello_status: 'connected',
      data_source: 'trello'
    },
    conversations: orders.map((order, index) => ({
      id: order.order_id,
      customer_name: order.customer,
      customer_email: '',
      quote_number: order.order_id,
      message: order.message || 'אין פרטי הזמנה נוספים',
      response: order.amount ? `סכום: ₪${order.amount}` : 'אין סכום',
      status: order.status,
      status_label: order.status_label,
      timestamp: new Date(order.timestamp).toISOString()
    })),
    orders
  };
}

function normalizeSummary(summary = {}) {
  return {
    total_conversations: Number(summary.total_conversations) || 0,
    pending_quotes: Number(summary.pending_quotes) || 0,
    approved_orders: Number(summary.approved_orders) || 0,
    in_progress: Number(summary.in_progress) || 0,
    total_orders: Number(summary.total_orders) || 0,
    total_revenue: Number(summary.total_revenue) || 0,
    average_order: Number(summary.average_order) || 0,
    conversion_rate: Number(summary.conversion_rate) || 0
  };
}

function updateLiveData(emailData) {
  try {
    let data = loadLiveData();

    const conversationIndex = data.conversations.findIndex(
      c => c.id === emailData.email_id || c.customer_email === emailData.customer_email
    );

    const conversation = {
      id: emailData.email_id || Math.random().toString(36).substr(2, 9),
      customer_name: emailData.customer_name || 'Unknown',
      customer_email: emailData.customer_email || '',
      quote_number: emailData.quote_number || emailData.email_id || '',
      message: emailData.message || '',
      response: emailData.response || '',
      status: emailData.type || 'quote',
      status_label: emailData.status_label || 'חדש',
      timestamp: emailData.timestamp || new Date().toISOString(),
      handled: emailData.handled !== undefined ? emailData.handled : true
    };

    if (conversationIndex >= 0) {
      data.conversations[conversationIndex] = {
        ...data.conversations[conversationIndex],
        ...conversation
      };
    } else {
      data.conversations.unshift(conversation);
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Updated conversation: ${emailData.customer_name} (handled: ${conversation.handled})`);
    return conversation;
  } catch (e) {
    console.error('Error updating live data:', e.message);
    return null;
  }
}

function normalizeN8nWebhookPayload(payload) {
  if (!payload) return null;
  let data = payload;

  if (Array.isArray(data) && data.length > 0) {
    data = data[0];
  }

  if (data.body && typeof data.body === 'object') {
    data = data.body;
  }

  if (data.data && typeof data.data === 'object' && data.data.summary) {
    data = data.data;
  }

  if (typeof data !== 'object') {
    return null;
  }

  return data;
}

async function fetchN8nWebhookData() {
  if (!N8N_WEBHOOK_URL) {
    return null;
  }

  try {
    const response = await axios.get(N8N_WEBHOOK_URL, { timeout: 15000 });
    return normalizeN8nWebhookPayload(response.data);
  } catch (e) {
    console.error('Error fetching N8N webhook data:', e.message);
    return null;
  }
}

async function getLiveData() {
  if (N8N_WEBHOOK_URL) {
    const webhookData = await fetchN8nWebhookData();
    if (webhookData && webhookData.summary) {
      return {
        summary: {
          ...normalizeSummary(webhookData.summary),
          data_source: 'n8n'
        },
        conversations: Array.isArray(webhookData.conversations) ? webhookData.conversations : [],
        orders: Array.isArray(webhookData.orders) ? webhookData.orders : []
      };
    }

    if (webhookData && (Array.isArray(webhookData.orders) || Array.isArray(webhookData.conversations))) {
      return {
        summary: {
          total_conversations: Array.isArray(webhookData.conversations) ? webhookData.conversations.length : 0,
          pending_quotes: 0,
          approved_orders: 0,
          in_progress: 0,
          total_orders: Array.isArray(webhookData.orders) ? webhookData.orders.length : 0,
          total_revenue: 0,
          average_order: 0,
          conversion_rate: 0,
          data_source: 'n8n'
        },
        conversations: Array.isArray(webhookData.conversations) ? webhookData.conversations : [],
        orders: Array.isArray(webhookData.orders) ? webhookData.orders : []
      };
    }
  }

  const trelloConfigured = Boolean(TRELLO_KEY && TRELLO_TOKEN && TRELLO_BOARD_ID);

  if (trelloConfigured) {
    try {
      const trelloLists = await fetchTrelloData();
      if (Array.isArray(trelloLists)) {
        return buildTrelloSummary(trelloLists);
      }
      console.warn('Trello data returned invalid list format, falling back to local data.');
    } catch (e) {
      console.error('Error fetching Trello data:', e.message);
    }
  }

  const data = loadLiveData();
  return {
    summary: {
      ...normalizeSummary(data.summary),
      data_source: data.summary?.data_source || 'local'
    },
    conversations: Array.isArray(data.conversations) ? data.conversations : [],
    orders: Array.isArray(data.orders) ? data.orders : []
  };
}

// Serve dashboard
app.get('/', (req, res) => {
  try {
    const html = fs.readFileSync(DASHBOARD_FILE, 'utf8');
    res.send(html);
  } catch (e) {
    res.status(500).send('Error loading dashboard: ' + e.message);
  }
});

app.get('/api/summary', async (req, res) => {
  const data = await getLiveData();
  res.json({
    ...data.summary,
    n8n_url: N8N_URL,
    data_source: data.summary?.data_source || (TRELLO_BOARD_ID ? 'trello' : 'local')
  });
});

app.get('/api/conversations', async (req, res) => {
  const data = await getLiveData();
  res.json(data.conversations);
});

app.get('/api/orders', async (req, res) => {
  const data = await getLiveData();
  res.json(data.orders);
});

app.get('/api/orders/:order_id', async (req, res) => {
  const orderId = req.params.order_id;
  const data = await getLiveData();
  const order = data.orders.find((item) => item.order_id === orderId);

  if (!order) {
    return res.status(404).json({ error: 'order_not_found', order_id: orderId });
  }

  res.json(order);
});

app.get('/api/live-data', async (req, res) => {
  res.json(await getLiveData());
});

// API: Webhook from N8N - receive processed email data
app.post('/api/webhook/n8n', (req, res) => {
  const payload = req.body;

  if (!payload || !payload.customer_email) {
    return res.status(400).json({ error: 'Missing required fields: customer_email' });
  }

  const result = updateLiveData(payload);

  if (result) {
    res.json({
      status: 'success',
      message: 'Email data recorded',
      conversation: result
    });
  } else {
    res.status(500).json({
      status: 'error',
      message: 'Failed to update live data'
    });
  }
});

// API: Get N8N webhook status (to verify live workflow connectivity)
app.get('/api/n8n-status', async (req, res) => {
  if (!N8N_WEBHOOK_URL) {
    return res.status(400).json({
      status: 'not_configured',
      error: 'N8N_WEBHOOK_URL not set',
      url: N8N_WEBHOOK_URL
    });
  }

  const statusResponse = {
    status: 'disconnected',
    url: N8N_WEBHOOK_URL,
    type: 'webhook'
  };

  try {
    const webhookData = await fetchN8nWebhookData();
    if (webhookData && (webhookData.summary || Array.isArray(webhookData.orders) || Array.isArray(webhookData.conversations))) {
      statusResponse.status = 'connected';
      statusResponse.data_source = 'n8n';
    } else {
      statusResponse.error = 'invalid_webhook_response';
    }
  } catch (e) {
    statusResponse.error = e.message;
  }

  if (process.env.N8N_API_KEY && N8N_URL) {
    try {
      const response = await axios.get(`${N8N_URL}/api/v1/workflows`, {
        headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
      });
      statusResponse.workflow_api = {
        status: 'connected',
        workflows: response.data.data ? response.data.data.length : 0,
        url: N8N_URL
      };
    } catch (e) {
      statusResponse.workflow_api = {
        status: 'disconnected',
        error: e.message,
        url: N8N_URL
      };
    }
  }

  const statusCode = statusResponse.status === 'connected' ? 200 : 502;
  res.status(statusCode).json(statusResponse);
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
  console.log(`📊 N8N Status: ${N8N_URL}`);
  console.log(`🔗 N8N Webhook: POST http://localhost:${PORT}/api/webhook/n8n`);
  console.log(`📝 Polling interval: 5 seconds\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down...');
  process.exit(0);
});
