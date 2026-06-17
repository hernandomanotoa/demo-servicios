/**
 * api-node — Microservicio Express básico.
 *
 * Expone endpoints JSON para validar conectividad del puerto 3001.
 * Al importarse como módulo no inicia el servidor (útil para tests).
 */
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

/** GET / — Información del servicio */
app.get('/', (req, res) => {
  res.json({ service: 'api-node', port: PORT, status: 'ok', time: new Date().toISOString() });
});

/** GET /health — Healthcheck simple */
app.get('/health', (req, res) => {
  res.json({ healthy: true });
});

module.exports = { app, PORT };

/** Iniciar servidor solo si se ejecuta directamente (no en tests) */
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API Node escuchando en http://0.0.0.0:${PORT}`);
  });
}
