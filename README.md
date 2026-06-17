# 🧪 Proyecto Demo Multi-Servicio — Test de Puertos

Este monorepo levanta **8 servicios simultáneos** dentro del contenedor para validar al 100% los mapeos de puertos definidos en la configuración externa.

---

## 📁 Estructura

```
/workspace/sipe/
├── apps/
│   ├── web-next/          → Next.js 14   (puerto 3000)
│   ├── web-vite/          → Vite + React (puerto 5173 / preview 4173)
│   ├── api-python/        → Python HTTP  (puerto 8000 → host:3004)
│   ├── api-node/          → Express      (puerto 3001)
│   ├── api-alt/           → Python HTTP  (puerto 8081 → host:3003)
│   ├── service-generic/   → Python HTTP  (puerto 9000 → host:3005)
│   └── gateway/           → Dashboard con WebSocket  (puerto 8080 → host:3002)
├── scripts/
│   └── test-ports.sh      → Script de validación de puertos
├── Makefile               → Orquestación de tareas
└── package.json           → Scripts globales
```

---

## 🔌 Mapa de Puertos (100% cubierto)

| Servicio            | Puerto Contenedor | Puerto Host | Estado |
|---------------------|-------------------|-------------|--------|
| Next.js             | 3000              | 3000        | ✅     |
| API Node            | 3001              | 3001        | ✅     |
| **Gateway / Status**| **8080**          | **3002**    | ✅     |
| API Alternativa     | 8081              | 3003        | ✅     |
| API Python          | 8000              | 3004        | ✅     |
| Servicio Genérico   | 9000              | 3005        | ✅     |
| Vite Dev            | 5173              | 5173        | ✅     |
| Vite Preview        | 4173              | 4173        | ✅     |

---

## 🚀 Uso rápido con Makefile

Desde `/workspace/sipe` dentro del contenedor:

```bash
make install      # Instala todas las dependencias Node
make dev          # Levanta los 8 servicios
make test         # Ejecuta tests Node + Python
make test-ports   # Valida que todos los puertos respondan
make build        # Compila frontends para producción
make stop         # Detiene todos los procesos de fondo
make help         # Muestra todos los comandos
```

---

## 🧪 Test desde tu máquina host

### Navegador (recomendado)

| URL | Qué verás |
|-----|-----------|
| `http://localhost:3002` | 🎛️ **Dashboard de status** en tiempo real vía WebSocket |
| `http://localhost:3000` | Next.js app |
| `http://localhost:5173` | Vite dev app |
| `http://localhost:4173` | Vite preview (build de producción) |

### curl

```bash
curl http://localhost:3002/api/status   # JSON con estado de todos los servicios
curl http://localhost:3000              # Next.js
curl http://localhost:5173              # Vite Dev
curl http://localhost:4173              # Vite Preview
curl http://localhost:3001              # API Node
curl http://localhost:3003              # API Alternativa
curl http://localhost:3004              # API Python
curl http://localhost:3005              # Servicio Genérico
```

---

## 🔌 WebSocket en tiempo real

El **Gateway** (`localhost:3002`) expone un endpoint WebSocket en:

```
ws://localhost:3002/ws
```

Cada 3 segundos el servidor consulta el estado de los 8 servicios y empuja la actualización a todos los clientes conectados. La página HTML se actualiza sola sin refrescar.

---

## ✅ Tests automatizados

### Node.js (`node:test` + `node:assert`)

```bash
cd apps/api-node && npm test    # 2 tests
cd apps/gateway && npm test     # 3 tests (incluye WebSocket)
```

### Python (`unittest` + `http.client`)

```bash
cd apps/api-python        && python3 test_main.py     # 4 tests
cd apps/api-alt           && python3 test_main.py     # 3 tests
cd apps/service-generic   && python3 test_server.py   # 1 test
```

### Todos juntos

```bash
make test
```

---

## 🛠 Tecnologías usadas

- **Node.js**: Next.js 14, Express, Vite 5 + React 18, WebSocket (`ws`)
- **Python 3.11**: Servidores HTTP built-in (`http.server` / `socketserver`)
- **Sin dependencias Python externas**: Todo funciona con la stdlib
- **Tests**: `node:test` (Node 20 built-in), `unittest` (Python stdlib)
- **Orquestación**: `concurrently`, `Makefile`

---

## 📜 Logs de los servicios

Los procesos están corriendo en background. Puedes ver sus outputs en los archivos de log del harness o usar:

```bash
ps aux | grep -E "node|python3"   # Ver procesos activos
```
