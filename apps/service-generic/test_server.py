import unittest
import subprocess
import time
import http.client
import json
import os
import socket


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class TestServiceGeneric(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = find_free_port()
        env = os.environ.copy()
        env['PORT'] = str(cls.port)
        cls.proc = subprocess.Popen(
            ['python3', 'server.py'],
            cwd=os.path.dirname(os.path.abspath(__file__)),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        time.sleep(1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            cls.proc.kill()

    def _get(self, path):
        conn = http.client.HTTPConnection('localhost', self.port, timeout=2)
        conn.request('GET', path)
        resp = conn.getresponse()
        data = resp.read().decode()
        conn.close()
        return resp.status, json.loads(data) if data else {}

    def test_root(self):
        status, body = self._get('/')
        self.assertEqual(status, 200)
        self.assertEqual(body['service'], 'service-generic')
        self.assertEqual(body['status'], 'ok')
        self.assertEqual(body['host_port'], 3005)


if __name__ == '__main__':
    unittest.main(verbosity=2)
