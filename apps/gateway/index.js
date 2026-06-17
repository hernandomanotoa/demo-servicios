/**
 * gateway — Dashboard de estado + Control de procesos
 *
 * Exponer un dashboard HTML con actualización en tiempo real vía WebSocket
 * y capacidad de iniciar, detener y reiniciar cada servicio desde el navegador.
 *
 * Estado visual: basado en health check HTTP (simple y robusto).
 * Control: start spawnea procesos; stop busca PID por puerto y lo mata.
 */
const express = require('express');
const cors = require('cors');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8080;

/**
 * Registro de servicios con metadatos y configuración de arranque.
 */
const services = [
  {
    name: 'Next.js', port: 3000, hostPort: 3000, type: 'frontend',
    host: process.env.WEB_NEXT_HOST,
    command: ['npm', 'run', 'dev'], cwd: '../web-next', env: {},
  },
  {
    name: 'API Node', port: 3001, hostPort: 3001, type: 'api',
    host: process.env.API_NODE_HOST,
    command: ['npm', 'run', 'dev'], cwd: '../api-node', env: {},
  },
  {
    name: 'Gateway / Status', port: 8080, hostPort: 3002, type: 'gateway',
    host: 'localhost',
    command: null, cwd: null, env: {},
  },
  {
    name: 'API Alternativa', port: 8081, hostPort: 3003, type: 'api',
    host: process.env.API_ALT_HOST,
    command: ['python3', 'main.py'], cwd: '../api-alt', env: {},
  },
  {
    name: 'API Python', port: 8000, hostPort: 3004, type: 'api',
    host: process.env.API_PYTHON_HOST,
    command: ['python3', 'main.py'], cwd: '../api-python', env: {},
  },
  {
    name: 'Servicio Genérico', port: 9000, hostPort: 3005, type: 'service',
    host: process.env.SERVICE_GENERIC_HOST,
    command: ['python3', 'server.py'], cwd: '../service-generic', env: {},
  },
  {
    name: 'Vite Dev', port: 5173, hostPort: 5173, type: 'frontend',
    host: process.env.WEB_VITE_HOST,
    command: ['npm', 'run', 'dev'], cwd: '../web-vite', env: {},
  },
  {
    name: 'Vite Preview', port: 4173, hostPort: 4173, type: 'frontend',
    host: process.env.WEB_VITE_PREVIEW_HOST,
    command: ['npm', 'run', 'preview'], cwd: '../web-vite', env: {},
  },
];

function getServiceByName(name) {
  return services.find((s) => s.name === name);
}

// Procesos que fueron iniciados por este gateway: { name: ChildProcess }
const spawnedProcesses = new Map();

/**
 * Busca el PID de un proceso que escuche en el puerto dado.
 * Devuelve null si no lo encuentra.
 */
function findPidByPort(port) {
  try {
    const out = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
    const pid = parseInt(out.trim().split('\n')[0], 10);
    return isNaN(pid) ? null : pid;
  } catch {
    try {
      const out = execSync(`fuser ${port}/tcp 2>/dev/null`, { encoding: 'utf-8' });
      const pid = parseInt(out.trim().split(/\s+/).pop(), 10);
      return isNaN(pid) ? null : pid;
    } catch {
      return null;
    }
  }
}

/**
 * Lee el cmdline de un PID (/proc/[pid]/cmdline usa \0 como separador).
 */
function getCmdline(pid) {
  try {
    const buf = require('fs').readFileSync(`/proc/${pid}/cmdline`);
    return buf.toString().replace(/\0/g, ' ').trim();
  } catch {
    return '';
  }
}

/**
 * Lee el cwd de un PID (symlink /proc/[pid]/cwd).
 */
function getCwd(pid) {
  try {
    return require('fs').readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return '';
  }
}

/**
 * Busca el PID de un servicio por su directorio de trabajo.
 * Útil cuando lsof/fuser no están disponibles.
 * Ignora wrappers de bash de Claude para no matar el wrapper equivocado.
 */
function findServicePidByCwd(svc) {
  const fs = require('fs');
  const path = require('path');
  const expectedCwd = path.resolve(__dirname, svc.cwd || '.');

  // Ejecutable real a buscar: python3, node, npm, etc.
  const executables = new Set(
    (svc.command || []).map(c => c.toLowerCase()).filter(c =>
      c === 'python3' || c === 'python' || c === 'node' || c === 'npm' || c === 'next'
    )
  );
  // Para npm, el proceso real suele ser node
  if (executables.has('npm')) executables.add('node');

  let bestPid = null;
  try {
    const entries = fs.readdirSync('/proc');
    for (const entry of entries) {
      if (!/^\d+$/.test(entry)) continue;
      const pid = parseInt(entry, 10);
      const cwd = getCwd(pid);
      if (cwd !== expectedCwd) continue;
      const cmdline = getCmdline(pid);

      // Ignorar wrappers de snapshot de bash
      if (cmdline.includes('/root/.claude/shell-snapshots')) continue;

      // Preferir proceso real (no /bin/bash wrapper)
      if (cmdline.startsWith('/bin/bash') || cmdline.startsWith('bash')) {
        if (!bestPid) bestPid = pid;
        continue;
      }

      // Si coincide con algún ejecutable esperado, perfecto
      const lower = cmdline.toLowerCase();
      const matchesExe = Array.from(executables).some(exe => lower.includes(exe));
      if (matchesExe || executables.size === 0) {
        return pid;
      }
      if (!bestPid) bestPid = pid;
    }
  } catch {
    // ignorar
  }
  return bestPid;
}

/**
 * Health check HTTP simple.
 */
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

// ── Process Control ───────────────────────────────────────────────────────

function startService(name) {
  return new Promise((resolve) => {
    const svc = getServiceByName(name);
    if (!svc) return resolve({ success: false, error: 'Servicio no encontrado' });
    if (!svc.command) return resolve({ success: false, error: 'Servicio no gestionable' });

    // Si ya está corriendo, no iniciar de nuevo
    if (spawnedProcesses.has(name)) {
      const existing = spawnedProcesses.get(name);
      if (!existing.killed && existing.exitCode === null) {
        return resolve({ success: false, error: 'Servicio ya está corriendo' });
      }
    }

    const cwd = svc.cwd ? require('path').resolve(__dirname, svc.cwd) : __dirname;
    const env = { ...process.env, ...svc.env };

    const child = spawn(svc.command[0], svc.command.slice(1), {
      cwd,
      env,
      stdio: 'ignore',
      detached: false,
    });

    spawnedProcesses.set(name, child);

    child.on('error', (err) => {
      spawnedProcesses.delete(name);
      resolve({ success: false, error: err.message });
    });

    child.on('exit', (code) => {
      spawnedProcesses.delete(name);
      // Si aún no resolvimos, reportar fallo
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: `El proceso terminó con código ${code}` });
      }
    });

    let resolved = false;
    const maxWait = 12000; // 12 segundos máximo para servicios pesados (Next.js/Vite)
    const interval = 600;  // chequear cada 600ms
    let elapsed = 0;

    const timer = setInterval(async () => {
      elapsed += interval;

      // Si el proceso murió, salir
      if (child.killed || child.exitCode !== null) {
        clearInterval(timer);
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'El proceso terminó antes de estar listo' });
        }
        return;
      }

      // Intentar health check
      const health = await checkService(svc);
      if (health.status === 'up') {
        clearInterval(timer);
        if (!resolved) {
          resolved = true;
          resolve({ success: true, name, pid: child.pid, state: 'up' });
        }
        return;
      }

      // Timeout
      if (elapsed >= maxWait) {
        clearInterval(timer);
        if (!resolved) {
          resolved = true;
          // Matar el proceso si nunca respondió
          try { child.kill('SIGKILL'); } catch {}
          spawnedProcesses.delete(name);
          resolve({ success: false, error: 'Timeout: el servicio no respondió en 12s' });
        }
      }
    }, interval);
  });
}

function stopService(name) {
  return new Promise((resolve) => {
    const svc = getServiceByName(name);
    if (!svc) return resolve({ success: false, error: 'Servicio no encontrado' });
    if (!svc.command) return resolve({ success: false, error: 'Servicio no gestionable' });

    // 1. Intentar matar el proceso que iniciamos nosotros
    const child = spawnedProcesses.get(name);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) child.kill('SIGKILL');
        spawnedProcesses.delete(name);
        resolve({ success: true, name, state: 'down' });
      }, 3000);
      return;
    }

    // 2. Buscar PID por puerto (lsof/fuser)
    let pid = findPidByPort(svc.port);

    // 3. Fallback: buscar por cwd + cmdline en /proc
    if (!pid) {
      pid = findServicePidByCwd(svc);
    }

    if (!pid) {
      return resolve({ success: false, error: 'Servicio no está corriendo' });
    }

    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ya terminó
    }

    setTimeout(() => {
      try {
        process.kill(pid, 0); // sigue vivo?
        process.kill(pid, 'SIGKILL');
      } catch {
        // ya murió
      }
      resolve({ success: true, name, state: 'down' });
    }, 3000);
  });
}

async function restartService(name) {
  await stopService(name);
  await new Promise((r) => setTimeout(r, 1000));
  return startService(name);
}

// ── Express Routes ────────────────────────────────────────────────────────

app.get('/', async (req, res) => {
  const initialData = await getStatus();
  const servicesJson = JSON.stringify(initialData.services);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧪 Docker Sipe — Control Dashboard</title>
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
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
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
      margin-top: 8px;
      color: #60a5fa;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .link:hover { text-decoration: underline; }
    .controls { margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
    .btn {
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.85; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-start { background: #10b981; color: white; }
    .btn-stop { background: #ef4444; color: white; }
    .btn-restart { background: #64748b; color: white; }
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
    <h1>🧪 Docker Sipe — Control Dashboard</h1>
    <p class="subtitle">Inicia, detén y monitorea los 8 servicios en tiempo real</p>
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
        const isManaged = s.name !== 'Gateway / Status';
        let buttons = '';
        if (isManaged) {
          if (s.status === 'up') {
            buttons = \`
              <button class="btn btn-stop" onclick="control('\${s.name}', 'stop')">Detener</button>
              <button class="btn btn-restart" onclick="control('\${s.name}', 'restart')">Reiniciar</button>
            \`;
          } else {
            buttons = \`<button class="btn btn-start" onclick="control('\${s.name}', 'start')">Iniciar</button>\`;
          }
        }
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
          <div class="controls">\${buttons}</div>
        </div>
      \`}).join('');
    }

    async function control(name, action) {
      try {
        const res = await fetch('/api/services/' + encodeURIComponent(name) + '/' + action, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          alert('Error: ' + (data.error || 'No se pudo completar la acción'));
        }
      } catch (err) {
        alert('Error de red: ' + err.message);
      }
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

app.post('/api/services/:name/start', async (req, res) => {
  const result = await startService(req.params.name);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/services/:name/stop', async (req, res) => {
  const result = await stopService(req.params.name);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/services/:name/restart', async (req, res) => {
  const result = await restartService(req.params.name);
  res.status(result.success ? 200 : 400).json(result);
});

// ── WebSocket ─────────────────────────────────────────────────────────────

let wss;
let localServer;

function broadcast(data) {
  if (!wss) return;
  const json = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(json);
  });
}

async function broadcastStatusImmediate() {
  broadcast(await getStatus());
}

function startServer(port = PORT) {
  const server = http.createServer(app);
  localServer = server;
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws) => {
    ws.send(JSON.stringify(await getStatus()));
  });

  const interval = setInterval(async () => {
    broadcast(await getStatus());
  }, 3000);

  server.on('close', () => clearInterval(interval));

  server.listen(port, '0.0.0.0', () => {
    console.log(`Gateway / Control Dashboard escuchando en http://0.0.0.0:${port}`);
    console.log(`WebSocket endpoint: ws://0.0.0.0:${port}/ws`);
  });

  return server;
}

module.exports = {
  app, services, checkService, getStatus, startServer,
  startService, stopService, restartService,
};

if (require.main === module) {
  startServer();
}
