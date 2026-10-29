import os
import time
from threading import Lock
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
BASE_URL = "https://www.habbo.com.br/api/public/users"
DELAY_SECONDS = 1.0
rate_lock = Lock()
last_request = 0.0
blocked_until = 0.0

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    return jsonify({"ok": True})

@app.post("/api/check")
def check():
    global last_request, blocked_until
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get("nick"), str):
        return jsonify({"error": "Envie um nickname."}), 400
    nick = data["nick"].strip()
    if not nick or len(nick) > 100 or any(ord(c) < 32 for c in nick):
        return jsonify({"error": "Nickname inválido."}), 400
    with rate_lock:
        now = time.monotonic()
        if now < blocked_until:
            return jsonify({"nick": nick, "status": "unknown", "detail": "Consultas temporariamente suspensas (429)."})
        wait = DELAY_SECONDS - (now - last_request)
        if wait > 0:
            time.sleep(wait)
        last_request = time.monotonic()
        try:
            response = requests.get(BASE_URL, params={"name": nick},
                                    headers={"User-Agent": "HabboNickChecker/1.0"},
                                    timeout=12)
        except requests.RequestException:
            return jsonify({"nick": nick, "status": "error", "detail": "Falha de conexão."})
        if response.status_code == 200:
            return jsonify({"nick": nick, "status": "occupied", "detail": "Usuário encontrado."})
        if response.status_code == 404:
            return jsonify({"nick": nick, "status": "not_found", "detail": "Não encontrado na API; disponibilidade não garantida."})
        if response.status_code == 429:
            retry = response.headers.get("Retry-After", "")
            try:
                seconds = min(3600, max(60, int(retry)))
            except ValueError:
                seconds = 120
            blocked_until = time.monotonic() + seconds
            return jsonify({"nick": nick, "status": "unknown", "detail": "Limite da API atingido (429). Consultas pausadas."})
        return jsonify({"nick": nick, "status": "unknown", "detail": f"Resposta HTTP {response.status_code}."})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")))
