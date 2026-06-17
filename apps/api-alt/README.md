# api-alt — Python HTTP API (alternativa)

Servidor HTTP de respaldo usando únicamente la librería estándar de Python.

## Endpoints

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/` | Info del servicio |
| GET | `/health` | `{ "healthy": true }` |

## Scripts

```bash
python3 main.py          # Inicia el servidor en localhost:8081
python3 test_main.py     # Ejecuta tests con unittest
```

## Puerto configurable

Usa la variable de entorno `PORT`:

```bash
PORT=9002 python3 main.py
```
