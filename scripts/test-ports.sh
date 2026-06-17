#!/usr/bin/env bash
set -e

echo "========================================="
echo "  Test de puertos del contenedor"
echo "========================================="
echo ""

HOST="localhost"

endpoints=(
  "3000:Next.js"
  "3001:API Node"
  "8080:Gateway/Status (host->3002)"
  "8081:API Alternativo (host->3003)"
  "5173:Vite Dev"
  "4173:Vite Preview"
  "8000:Python/FastAPI (host->3004)"
  "9000:Servicio Genérico (host->3005)"
)

for ep in "${endpoints[@]}"; do
  port="${ep%%:*}"
  name="${ep#*:}"
  if curl -s -o /dev/null -w "%{http_code}" "http://${HOST}:${port}" | grep -q "200\|404"; then
    echo "✅  Puerto ${port} (${name}) - RESPONDE"
  else
    echo "❌  Puerto ${port} (${name}) - SIN RESPUESTA"
  fi
done

echo ""
echo "========================================="
