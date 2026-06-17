const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app, PORT } = require('../index.js');

let server;
let baseUrl;

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

describe('api-node', () => {
  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('GET / devuelve service info', async () => {
    const res = await request('/');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.service, 'api-node');
    assert.strictEqual(res.body.status, 'ok');
    assert.ok(res.body.time);
    assert.strictEqual(res.body.port, PORT);
  });

  it('GET /health devuelve healthy', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.healthy, true);
  });
});
