# api-node — Express API

Microservicio Node.js/Express que expone endpoints JSON básicos.

## Endpoints

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/` | Info del servicio |
| GET | `/health` | `{ "healthy": true }` |

## Scripts

```bash
npm run dev     # Inicia el servidor en localhost:3001
npm test        # Ejecuta tests con node:test
```

## Tests

Ubicados en `test/index.test.js`. Usan `node:test` + `node:assert` (built-in).
