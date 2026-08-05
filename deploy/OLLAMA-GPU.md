# Ollama on a separate GPU VM

Aegis API keeps talking to Ollama over LAN. Do **not** run the LLM on the chat VM.

## GPU host

```bash
# Install Ollama, then:
export OLLAMA_HOST=0.0.0.0:11434
ollama serve   # or systemd service with OLLAMA_HOST
ollama pull llama3.2
# firewall: allow LAN only to :11434
```

## Main Aegis API `.env` (chat VM)

```env
OLLAMA_URL=http://192.168.1.XXX:11434
OLLAMA_MODEL=llama3.2
OLLAMA_TIMEOUT_MS=120000
```

Then:

```bash
cd /opt/aegis-chat/deploy
docker compose -f docker-compose.lan.yml up -d --build api
curl -s http://127.0.0.1:3001/ai/status
```

`configured: true` + reachable Ollama → AI Chat module works.
