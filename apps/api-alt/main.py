"""
api-alt — Servidor HTTP alternativo con Python stdlib.

Expone endpoints JSON en el puerto 8081 (host:3003).
El puerto es configurable via variable de entorno PORT.
"""
import http.server
import socketserver
import json
import os
from datetime import datetime

PORT = int(os.environ.get('PORT', 8081))


class APIHandler(http.server.BaseHTTPRequestHandler):
    """Handler que responde JSON con CORS habilitado."""

    def log_message(self, format, *args):
        print(f"[{datetime.utcnow().isoformat()}] {args[0]}")

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def do_GET(self):
        if self.path == "/":
            self._send_json({
                "service": "api-alt",
                "port": PORT,
                "host_port": 3003,
                "status": "ok",
                "time": datetime.utcnow().isoformat()
            })
        elif self.path == "/health":
            self._send_json({"healthy": True})
        else:
            self._send_json({"error": "Not found"}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()


if __name__ == '__main__':
    with socketserver.TCPServer(("0.0.0.0", PORT), APIHandler) as httpd:
        print(f"API Alternativa escuchando en http://0.0.0.0:{PORT} (accesible desde host en puerto 3003)")
        httpd.serve_forever()
