# gateway — Dashboard + WebSocket

Gateway central que expone un dashboard HTML con actualización en tiempo real vía WebSocket.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Dashboard HTML con tarjetas de estado + **links directos** + botones de control |
| GET | `/api/status` | JSON con estado de todos los servicios |
| GET | `/health` | `{ "healthy": true }` |
| POST | `/api/services/:name/start` | Inicia el servicio (spawn) |
| POST | `/api/services/:name/stop` | Detiene el servicio (SIGTERM → SIGKILL) |
| POST | `/api/services/:name/restart` | Reinicia el servicio (stop + start) |
| WS | `/ws` | WebSocket — broadcast de estado cada 3s + inmediato tras control |

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

## Control de procesos

El gateway puede iniciar, detener y reiniciar servicios gestionables (todos excepto Gateway / Status).

### Flujo de detención

1. Si el gateway inició el proceso (lo tiene en `spawnedProcesses`), envía `SIGTERM` y espera 3s; si sigue vivo, envía `SIGKILL`.
2. Si no lo inició el gateway, busca el PID por puerto (`lsof` / `fuser`).
3. Fallback: escanea `/proc/[pid]/cwd` y `/proc/[pid]/cmdline` para encontrar el proceso por su directorio de trabajo (útil en contenedores sin `lsof`).
4. Ignora wrappers de bash (`/root/.claude/shell-snapshots`) para no matar el proceso equivocado.

### Ejemplo

```bash
curl -X POST http://localhost:8080/api/services/API%20Alternativa/stop
curl -X POST http://localhost:8080/api/services/API%20Alternativa/start
curl -X POST http://localhost:8080/api/services/API%20Alternativa/restart
```

Respuesta:
```json
{ "success": true, "name": "API Alternativa", "pid": 5977, "state": "up" }
```

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
