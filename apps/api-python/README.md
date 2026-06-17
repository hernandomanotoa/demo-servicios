# api-python — Python HTTP API

Servidor HTTP minimalista usando únicamente la librería estándar de Python.

## Endpoints

| Método | Ruta | Respuesta |
|--------|------|-----------|
| GET | `/` | Info del servicio |
| GET | `/health` | `{ "healthy": true }` |
| GET | `/items/{id}` | `{ "item_id": id }` |

## Scripts

```bash
python3 main.py          # Inicia el servidor en localhost:8000
python3 test_main.py     # Ejecuta tests con unittest
```

## Puerto configurable

Usa la variable de entorno `PORT` para cambiar el puerto (útil para tests):

```bash
PORT=9001 python3 main.py
```
