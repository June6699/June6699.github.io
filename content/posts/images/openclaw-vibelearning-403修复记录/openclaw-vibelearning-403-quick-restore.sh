#!/usr/bin/env bash
set -euo pipefail

API_KEY="${VIBE_API_KEY:-}"
UPSTREAM_URL="${OPENCLAW_VIBE_UPSTREAM:-https://api.vibelearning.top}"
PROXY_PORT="${OPENCLAW_VIBE_PROXY_PORT:-51888}"
PROXY_BASE_URL="http://127.0.0.1:${PROXY_PORT}/v1"
PROXY_SCRIPT="${HOME}/.local/bin/openclaw-vibelearning-proxy.py"
SERVICE_FILE="${HOME}/.config/systemd/user/openclaw-vibelearning-proxy.service"
OPENCLAW_JSON="${HOME}/.openclaw/openclaw.json"
MODELS_JSON="${HOME}/.openclaw/agents/main/agent/models.json"

mkdir -p "${HOME}/.local/bin" "${HOME}/.config/systemd/user" /tmp/openclaw

cat > "${PROXY_SCRIPT}" <<PY
#!/usr/bin/env python3
import json
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

UPSTREAM = "${UPSTREAM_URL}"
LOG_PATH = "/tmp/openclaw/vibelearning-proxy-log.jsonl"


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _write_log(self, payload):
        Path(LOG_PATH).parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False) + "\\n")

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
    server = ThreadingHTTPServer(("127.0.0.1", ${PROXY_PORT}), ProxyHandler)
    server.serve_forever()
PY

chmod +x "${PROXY_SCRIPT}"

cat > "${SERVICE_FILE}" <<SERVICE
[Unit]
Description=OpenClaw VibeLearning compatibility proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 ${PROXY_SCRIPT}
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
SERVICE

python3 - "${OPENCLAW_JSON}" "${MODELS_JSON}" "${PROXY_BASE_URL}" "${API_KEY}" <<'PY'
import json
import shutil
import sys
from copy import deepcopy
from datetime import datetime
from pathlib import Path

openclaw_json = Path(sys.argv[1]).expanduser()
models_json = Path(sys.argv[2]).expanduser()
proxy_base_url = sys.argv[3]
api_key = sys.argv[4]

provider_names = ("custom-api-vibelearning-top", "vibe-coding-codex")

model_template = {
    "id": "gpt-5.4",
    "name": "gpt-5.4 (Custom Provider)",
    "reasoning": False,
    "input": ["text"],
    "cost": {
        "input": 0,
        "output": 0,
        "cacheRead": 0,
        "cacheWrite": 0,
    },
    "contextWindow": 128000,
    "maxTokens": 4096,
    "api": "openai-responses",
}


def backup(path):
    if not path.exists():
        return
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(path.name + f".bak.{ts}")
    shutil.copy2(path, backup_path)


def load_json(path, default):
    if not path.exists():
        return deepcopy(default)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ensure_model_list(provider):
    models = provider.setdefault("models", [])
    found = False
    for model in models:
        if isinstance(model, dict) and model.get("id") == "gpt-5.4":
            for key, value in model_template.items():
                model[key] = deepcopy(value)
            found = True
            break
    if not found:
        models.append(deepcopy(model_template))


def ensure_provider(provider):
    provider["baseUrl"] = proxy_base_url
    provider["api"] = "openai-responses"
    if api_key:
        provider["apiKey"] = api_key
    ensure_model_list(provider)


models_data = load_json(models_json, {"providers": {}})
models_providers = models_data.setdefault("providers", {})
for name in provider_names:
    provider = models_providers.setdefault(name, {})
    ensure_provider(provider)

models_json.parent.mkdir(parents=True, exist_ok=True)
backup(models_json)
with open(models_json, "w", encoding="utf-8") as f:
    json.dump(models_data, f, ensure_ascii=False, indent=2)
    f.write("\n")


openclaw_data = load_json(openclaw_json, {})
agents_defaults = openclaw_data.setdefault("agents", {}).setdefault("defaults", {})
agents_defaults.setdefault("model", {})["primary"] = "custom-api-vibelearning-top/gpt-5.4"
agent_models = agents_defaults.setdefault("models", {})
agent_models.setdefault("custom-api-vibelearning-top/gpt-5.4", {})
agent_models.setdefault("vibe-coding-codex/gpt-5.4", {})

openclaw_providers = openclaw_data.setdefault("models", {}).setdefault("providers", {})
for name in provider_names:
    provider = openclaw_providers.setdefault(name, {})
    ensure_provider(provider)

openclaw_json.parent.mkdir(parents=True, exist_ok=True)
backup(openclaw_json)
with open(openclaw_json, "w", encoding="utf-8") as f:
    json.dump(openclaw_data, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY

systemctl --user daemon-reload
systemctl --user enable --now openclaw-vibelearning-proxy.service

echo
echo "Compatibility proxy restored."
echo "Proxy base URL: ${PROXY_BASE_URL}"
if [ -z "${API_KEY}" ]; then
  echo "VIBE_API_KEY is empty, so existing apiKey values were kept."
else
  echo "apiKey fields were updated from VIBE_API_KEY."
fi
echo
echo "Recommended verification command:"
echo "openclaw infer model run --local --model custom-api-vibelearning-top/gpt-5.4 --prompt 'hello' --json"
