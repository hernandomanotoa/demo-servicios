# gateway — Dashboard + WebSocket

Gateway central que expone un dashboard HTML con actualización en tiempo real vía WebSocket.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Dashboard HTML con tarjetas de estado + **links directos** a cada servicio |
| GET | `/api/status` | JSON con estado de todos los servicios |
| GET | `/health` | `{ "healthy": true }` |
| WS | `/ws` | WebSocket — broadcast de estado cada 3s |

## Protocolo WebSocket

### Mensaje del servidor (broadcast cada 3 segundos)

```json
{
  "services": [
    {
      "name": "Next.js",
      "port": 3000,
      "hostPort": 3000,
      "type": "frontend",
      "status": "up",
      "code": 200
    }
  ],
  "updatedAt": "2026-06-17T19:30:00.000Z"
}
```

### Estados posibles

- `status: "up"` + `code: 200` — Servicio responde correctamente
- `status: "down"` + `code: null` — Servicio no responde o timeout

## Scripts

```bash
npm run dev     # Inicia gateway en localhost:8080
npm test        # Tests HTTP + WebSocket
```

## Hosts configurables (Docker / redes)

Cada servicio puede apuntar a un host diferente via variables de entorno:

```bash
WEB_NEXT_HOST=web-next API_NODE_HOST=api-node npm run dev
```

Por defecto todos apuntan a `localhost`.
