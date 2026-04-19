#!/usr/bin/env python3
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UPSTREAM = "https://api.vibelearning.top"
LOG_PATH = "/tmp/openclaw/vibelearning-proxy-log.jsonl"


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _write_log(self, payload):
        Path(LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def _handle(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length > 0 else b""
        upstream_url = f"{UPSTREAM}{self.path}"
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in {"host", "connection", "proxy-connection", "content-length"}
        }
        if headers.get("User-Agent", "").startswith("OpenAI/JS"):
            headers["User-Agent"] = "curl/8.7.1"
        if headers.get("user-agent", "").startswith("OpenAI/JS"):
            headers["user-agent"] = "curl/8.7.1"

        record = {
            "method": self.command,
            "path": self.path,
            "headers": headers,
            "body_text": body.decode("utf-8", errors="replace"),
        }

        try:
            req = Request(
                upstream_url,
                data=body if self.command != "GET" else None,
                headers=headers,
                method=self.command,
            )
            with urlopen(req, timeout=120) as resp:
                resp_body = resp.read()
                status = resp.status
                resp_headers = dict(resp.headers.items())
        except HTTPError as e:
            resp_body = e.read()
            status = e.code
            resp_headers = dict(e.headers.items())
        except URLError as e:
            msg = str(e).encode("utf-8", errors="replace")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            record["proxy_error"] = str(e)
            self._write_log(record)
            return

        record["response_status"] = status
        record["response_body_text"] = resp_body.decode("utf-8", errors="replace")
        self._write_log(record)

        self.send_response(status)
        hop_by_hop = {
            "transfer-encoding",
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "upgrade",
        }
        for key, value in resp_headers.items():
            if key.lower() in hop_by_hop:
                continue
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(resp_body)))
        self.end_headers()
        self.wfile.write(resp_body)

    def do_POST(self):
        self._handle()

    def do_GET(self):
        self._handle()

    def log_message(self, format, *args):
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 51888), ProxyHandler)
    server.serve_forever()
