const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const WebSocket = require('ws');
const { app, startServer } = require('../index.js');

let server;
let baseUrl;
let wsUrl;

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

describe('gateway', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET /health devuelve healthy', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.healthy, true);
  });

  it('GET /api/status devuelve lista de servicios', async () => {
    const res = await request('/api/status');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.services));
    assert.strictEqual(res.body.services.length, 8);
    assert.ok(res.body.updatedAt);
  });

  it('WebSocket /ws recibe mensaje JSON', async () => {
    // Usamos startServer(0) para puerto efímero y esperamos evento 'listening'
    const wsServer = startServer(0);
    const testWsUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('listen timeout')), 3000);
      wsServer.on('listening', () => {
        clearTimeout(timer);
        const addr = wsServer.address();
        resolve(`ws://127.0.0.1:${addr.port}/ws`);
      });
      wsServer.on('error', reject);
    });

    const msg = await new Promise((resolve, reject) => {
      const ws = new WebSocket(testWsUrl);
      const timer = setTimeout(() => {
        ws.terminate();
        reject(new Error('WS timeout'));
      }, 3000);
      ws.on('message', (data) => {
        clearTimeout(timer);
        ws.close();
        resolve(JSON.parse(data));
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    assert.ok(Array.isArray(msg.services));
    assert.strictEqual(msg.services.length, 8);
    assert.ok(msg.updatedAt);
    await new Promise((resolve) => wsServer.close(resolve));
  });
});
