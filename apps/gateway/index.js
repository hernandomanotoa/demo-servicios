const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;

const services = [
  { name: 'Next.js', port: 3000, hostPort: 3000, type: 'frontend', host: process.env.WEB_NEXT_HOST },
  { name: 'API Node', port: 3001, hostPort: 3001, type: 'api', host: process.env.API_NODE_HOST },
  { name: 'Gateway / Status', port: 8080, hostPort: 3002, type: 'gateway', host: 'localhost' },
  { name: 'API Alternativa', port: 8081, hostPort: 3003, type: 'api', host: process.env.API_ALT_HOST },
  { name: 'API Python', port: 8000, hostPort: 3004, type: 'api', host: process.env.API_PYTHON_HOST },
  { name: 'Servicio Genérico', port: 9000, hostPort: 3005, type: 'service', host: process.env.SERVICE_GENERIC_HOST },
  { name: 'Vite Dev', port: 5173, hostPort: 5173, type: 'frontend', host: process.env.WEB_VITE_HOST },
  { name: 'Vite Preview', port: 4173, hostPort: 4173, type: 'frontend', host: process.env.WEB_VITE_PREVIEW_HOST },
];

function checkService(service) {
  return new Promise((resolve) => {
    const host = service.host || 'localhost';
    const req = http.get(`http://${host}:${service.port}`, { timeout: 2000 }, (res) => {
      resolve({ ...service, status: 'up', code: res.statusCode });
    });
    req.on('error', () => {
      resolve({ ...service, status: 'down', code: null });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ...service, status: 'down', code: null });
    });
  });
}

async function getStatus() {
  const results = await Promise.all(services.map(checkService));
  return { services: results, updatedAt: new Date().toISOString() };
}

app.get('/', async (req, res) => {
  const initialData = await getStatus();
  const servicesJson = JSON.stringify(initialData.services);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧪 Docker Sipe — Status Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #eaeaea;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 10px; font-size: 2rem; }
    .subtitle { text-align: center; color: #a0a0a0; margin-bottom: 40px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover { transform: translateY(-4px); border-color: rgba(255,255,255,0.3); }
    .card.up { border-left: 4px solid #4ade80; }
    .card.down { border-left: 4px solid #f87171; opacity: 0.7; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .badge.api { background: #3b82f6; color: white; }
    .badge.frontend { background: #a855f7; color: white; }
    .badge.service { background: #f59e0b; color: white; }
    .badge.gateway { background: #10b981; color: white; }
    .card h3 { font-size: 1.1rem; margin-bottom: 8px; }
    .port { font-family: monospace; color: #94a3b8; font-size: 0.9rem; }
    .status { margin-top: 12px; font-weight: 600; font-size: 0.9rem; }
    .status.up { color: #4ade80; }
    .status.down { color: #f87171; }
    .link {
      display: inline-block;
      margin-top: 10px;
      color: #60a5fa;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .link:hover { text-decoration: underline; }
    .link svg {
      width: 12px;
      height: 12px;
      margin-left: 4px;
      vertical-align: middle;
    }
    .footer { text-align: center; margin-top: 50px; color: #64748b; font-size: 0.85rem; }
    .timestamp { text-align: center; margin-top: 10px; color: #94a3b8; font-size: 0.8rem; }
    .connection-status {
      position: fixed;
      top: 12px;
      right: 12px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(6px);
    }
    .connection-status.connected { background: #10b981; color: white; }
    .connection-status.disconnected { background: #f87171; color: white; }
  </style>
</head>
<body>
  <div class="connection-status disconnected" id="conn">● WS</div>
  <div class="container">
    <h1>🧪 Docker Sipe — Status Dashboard</h1>
    <p class="subtitle">Contenedor <code>claude-kimi</code> — Puertos mapeados desde host</p>
    <div class="grid" id="grid"></div>
    <div class="timestamp" id="timestamp"></div>
    <div class="footer">Actualizando en tiempo real vía WebSocket</div>
  </div>
  <script>
    const initialServices = ${servicesJson};
    const grid = document.getElementById('grid');
    const timestamp = document.getElementById('timestamp');
    const conn = document.getElementById('conn');

    function render(services) {
      grid.innerHTML = services.map(s => {
        const link = 'http://localhost:' + s.hostPort;
        return \`
        <div class="card \${s.status}">
          <span class="badge \${s.type}">\${s.type}</span>
          <h3>\${s.name}</h3>
          <div class="port">Contenedor: <strong>\${s.port}</strong></div>
          <div class="port">Host: <strong>\${s.hostPort}</strong></div>
          <div class="status \${s.status}">
            \${s.status === 'up' ? '● Online' : '○ Offline'}
            \${s.code ? '(' + s.code + ')' : ''}
          </div>
          <a class="link" href="\${link}" target="_blank" rel="noopener">
            Abrir en localhost:\${s.hostPort} ↗
          </a>
        </div>
      \`}).join('');
    }

    function updateConn(connected) {
      conn.className = 'connection-status ' + (connected ? 'connected' : 'disconnected');
      conn.textContent = connected ? '● WS conectado' : '● WS desconectado';
    }

    render(initialServices);
    timestamp.textContent = 'Última actualización: ' + new Date().toISOString();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(protocol + '//' + location.host + '/ws');

    ws.onopen = () => updateConn(true);
    ws.onclose = () => updateConn(false);
    ws.onerror = () => updateConn(false);
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      render(data.services);
      timestamp.textContent = 'Última actualización: ' + data.updatedAt;
    };
  </script>
</body>
</html>`;

  res.send(html);
});

app.get('/api/status', async (req, res) => {
  res.json(await getStatus());
});

app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

let wss;
function broadcast(data) {
  if (!wss) return;
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(json);
    }
  });
}

function startServer(port = PORT) {
  const server = http.createServer(app);
  const localWss = new WebSocketServer({ server, path: '/ws' });

  localWss.on('connection', async (ws) => {
    ws.send(JSON.stringify(await getStatus()));
  });

  const interval = setInterval(async () => {
    const data = await getStatus();
    const json = JSON.stringify(data);
    localWss.clients.forEach((client) => {
      if (client.readyState === 1) client.send(json);
    });
  }, 3000);

  server.on('close', () => clearInterval(interval));

  server.listen(port, '0.0.0.0', () => {
    console.log(`Gateway / Status Dashboard escuchando en http://0.0.0.0:${port} (host: http://localhost:3002)`);
    console.log(`WebSocket endpoint: ws://0.0.0.0:${port}/ws`);
  });

  return server;
}

module.exports = { app, services, checkService, getStatus, startServer };

if (require.main === module) {
  startServer();
}
