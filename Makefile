.PHONY: install dev test test-ports stop build help

help:
	@echo "Comandos disponibles:"
	@echo "  make install    - Instala dependencias Node en todas las apps"
	@echo "  make dev        - Levanta todos los servicios en modo desarrollo"
	@echo "  make test       - Ejecuta tests Node y Python"
	@echo "  make test-ports - Valida que todos los puertos respondan"
	@echo "  make stop       - Detiene todos los procesos de fondo"
	@echo "  make build      - Compila Next.js y Vite para producción"

install:
	@echo "==> Instalando dependencias..."
	cd apps/api-node && npm install
	cd apps/gateway && npm install
	cd apps/web-next && npm install
	cd apps/web-vite && npm install
	cd /workspace/sipe && npm install
	@echo "==> Instalación completa."

dev:
	@echo "==> Levantando todos los servicios..."
	npx concurrently \
		-n "api-node,api-python,api-alt,svc-generic,gateway,web-next,web-vite" \
		"cd apps/api-node && npm run dev" \
		"cd apps/api-python && python3 main.py" \
		"cd apps/api-alt && python3 main.py" \
		"cd apps/service-generic && python3 server.py" \
		"cd apps/gateway && npm run dev" \
		"cd apps/web-next && npm run dev" \
		"cd apps/web-vite && npm run dev"

test:
	@echo "==> Ejecutando tests Node..."
	cd apps/api-node && npm test
	cd apps/gateway && npm test
	@echo "==> Ejecutando tests Python..."
	cd apps/api-python && python3 test_main.py
	cd apps/api-alt && python3 test_main.py
	cd apps/service-generic && python3 test_server.py
	@echo "==> Todos los tests pasaron."

test-ports:
	bash scripts/test-ports.sh

stop:
	@echo "==> Deteniendo servicios..."
	-pkill -f "node apps/api-node/index.js" 2>/dev/null || true
	-pkill -f "node apps/gateway/index.js" 2>/dev/null || true
	-pkill -f "next dev" 2>/dev/null || true
	-pkill -f "vite" 2>/dev/null || true
	-pkill -f "python3 apps/api-python/main.py" 2>/dev/null || true
	-pkill -f "python3 apps/api-alt/main.py" 2>/dev/null || true
	-pkill -f "python3 apps/service-generic/server.py" 2>/dev/null || true
	@echo "==> Servicios detenidos."

build:
	@echo "==> Compilando frontends..."
	cd apps/web-next && npm run build
	cd apps/web-vite && npm run build
	@echo "==> Build completo."
