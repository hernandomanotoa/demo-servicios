"""
api-python — Servidor HTTP minimalista con Python stdlib.

Expone endpoints JSON en el puerto 8000 (host:3004).
El puerto es configurable via variable de entorno PORT.
"""
import http.server
import socketserver
import json
import os
from datetime import datetime

PORT = int(os.environ.get('PORT', 8000))


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
                "service": "api-python",
                "port": PORT,
                "host_port": 3004,
                "status": "ok",
                "time": datetime.utcnow().isoformat()
            })
        elif self.path == "/health":
            self._send_json({"healthy": True})
        elif self.path.startswith("/items/"):
            try:
                item_id = int(self.path.split("/")[2])
                self._send_json({"item_id": item_id})
            except (IndexError, ValueError):
                self._send_json({"error": "Invalid item_id"}, 400)
        else:
            self._send_json({"error": "Not found"}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), APIHandler) as httpd:
        print(f"API Python escuchando en http://0.0.0.0:{PORT} (accesible desde host en puerto 3004)")
        httpd.serve_forever()
