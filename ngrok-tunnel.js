const { exec } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const NGROK_AUTH_TOKEN = '3CYvPsbTjXIiX5UR2HCoGlW7XwV_36DDSNsCdekbJumk4J4gE';
const N8N_LOCAL_URL = 'http://localhost:5678';
const CONFIG_FILE = path.join(__dirname, '.ngrok_url.json');

function getPublicUrl() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 4040,
      path: '/api/tunnels',
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.tunnels && parsed.tunnels.length > 0) {
            const url = parsed.tunnels[0].public_url;
            resolve(url);
          } else {
            reject(new Error('No tunnels found'));
          }
        } catch(e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function startTunnel() {
  console.log('🌐 מתחבר ל-Ngrok...');

  // Detect OS and use appropriate ngrok command
  const isWindows = os.platform() === 'win32';
  const ngrokCmd = `ngrok http 5678 --authtoken ${NGROK_AUTH_TOKEN}`;

  // Start ngrok
  const ngrok = exec(ngrokCmd, (error, stdout, stderr) => {
    if (error && !error.killed) {
      console.error('❌ שגיאה:', error.message);
      process.exit(1);
    }
  });

  // Get output
  ngrok.stdout?.on('data', (data) => {
    console.log(data.toString());
  });

  ngrok.stderr?.on('data', (data) => {
    console.error(data.toString());
  });

  // Wait for ngrok to start and get URL
  await new Promise(r => setTimeout(r, 3000));

  for (let i = 0; i < 5; i++) {
    try {
      const publicUrl = await getPublicUrl();

      const config = {
        n8n_public_url: publicUrl,
        n8n_local_url: N8N_LOCAL_URL,
        created_at: new Date().toISOString(),
        expires: 'When ngrok stops'
      };

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

      console.log('\n✅ Ngrok Tunnel פתוח!');
      console.log(`📍 Public URL: ${publicUrl}`);
      console.log(`🔗 N8N accessible at: ${publicUrl}`);
      console.log(`\n💾 URL שמור בקובץ: .ngrok_url.json`);
      console.log(`⏸️  Ctrl+C to stop tunnel\n`);
      break;
    } catch(err) {
      if (i < 4) {
        await new Promise(r => setTimeout(r, 1000));
      } else {
        console.error('❌ לא הצלחתי למצוא את ה-URL:', err.message);
        console.log('וודא ש-N8N רץ ב-http://localhost:5678');
      }
    }
  }

  process.on('SIGINT', () => {
    console.log('\n🛑 סוגר את ה-tunnel...');
    ngrok.kill();
    process.exit(0);
  });
}

startTunnel().catch(err => {
  console.error('❌ שגיאה:', err.message);
  process.exit(1);
});
