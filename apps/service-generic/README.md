# service-generic — Servicio genérico Python

Servidor HTTP de propósito general usando la librería estándar de Python.

## Endpoints

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/` | Info del servicio |

## Scripts

```bash
python3 server.py          # Inicia el servidor en localhost:9000
python3 test_server.py     # Ejecuta tests con unittest
```

## Puerto configurable

Usa la variable de entorno `PORT`:

```bash
PORT=9003 python3 server.py
```
