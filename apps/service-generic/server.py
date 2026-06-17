"""
service-generic — Servicio de propósito general con Python stdlib.

Responde JSON básico en el puerto 9000 (host:3005).
El puerto es configurable via variable de entorno PORT.
"""
import http.server
import socketserver
import json
import os
from datetime import datetime

PORT = int(os.environ.get('PORT', 9000))


class Handler(http.server.SimpleHTTPRequestHandler):
    """Handler mínimo que devuelve info del servicio en JSON."""

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        data = {
            "service": "service-generic",
            "port": PORT,
            "host_port": 3005,
            "status": "ok",
            "time": datetime.utcnow().isoformat()
        }
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        print(f"[{datetime.utcnow().isoformat()}] {args[0]}")


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Servicio genérico escuchando en http://0.0.0.0:{PORT}")
        httpd.serve_forever()
