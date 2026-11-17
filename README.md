# Ollama MCP Agent

A small JavaScript/Node.js AI agent that uses a local Ollama model, custom JavaScript tools, and dynamically discovered tools from a remote Model Context Protocol (MCP) server. The default MCP endpoint is Microsoft's public Learn MCP server.

> Status: experimental starter project. The code has been syntax-checked, but live Ollama and Microsoft MCP calls must be tested in your Termux/Ubuntu environment.

## Architecture

```text
Android browser
  └── Python static server :8080 (index.html + frontend.js)
        └── Node.js API :3000
              ├── Agent loop / dispatcher
              ├── Local tools (src/function_call.js)
              ├── MCP client (src/mcp/client.js)
              │     └── https://learn.microsoft.com/api/mcp
              └── Ollama API :11434
```

Python only serves static frontend files. Node.js owns the agent, tool execution and MCP connection. The browser does not connect directly to Ollama or Microsoft MCP.

## Project structure

```text
ollama-mcp-agent/
├── index.html
├── frontend.js
├── package.json
├── .env.example
├── .gitignore
└── src/
    ├── server.js
    ├── help.js
    ├── tools.js
    ├── function_call.js
    ├── logger.js
    └── mcp/
        ├── client.js
        └── test-connection.js
```

## Requirements

- Node.js 20.18.1 or newer (Node.js 22 LTS is a good choice; check with `node --version`)
- npm
- Ollama installed and running in the same Ubuntu/Termux network environment as Node.js
- A model with tool/function-calling support pulled into Ollama
- Python 3 (for serving the static frontend)
- Internet access for Microsoft Learn MCP and the online local tools

## Install in Termux / Ubuntu

```bash
cd ~/ollama-mcp-agent
cp .env.example .env
npm install
```

Edit `.env` if needed. The default model is `qwen2.5:0.5b`; this is retained as a starting setting, but small models may not reliably select and use tools. Use a tool-capable model available in your Ollama installation and set its exact name in `OLLAMA_MODEL`.

Pull a model if you have not already done so, for example:

```bash
ollama pull qwen2.5:0.5b
```

## Test Microsoft Learn MCP first

```bash
npm run mcp:test
```

A successful test prints the tools discovered from the Microsoft Learn MCP server. If it fails, check internet access, Node.js version and the MCP endpoint before continuing.

## Run the project

Use three terminal sessions (or `tmux` panes):

**Terminal 1 — Ollama**

```bash
ollama serve
```

If Ollama is already running as a service, do not start a second instance.

**Terminal 2 — Node.js agent backend**

```bash
cd ~/ollama-mcp-agent
npm start
```

**Terminal 3 — Frontend static server**

```bash
cd ~/ollama-mcp-agent
python3 -m http.server 8080 --bind 127.0.0.1
```

Open this address in the Android browser:

```text
http://127.0.0.1:8080
```

Backend health check:

```bash
curl http://127.0.0.1:3000/api/health
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `qwen2.5:0.5b` | Ollama model name |
| `MCP_ENABLED` | `true` | Enable/disable MCP connection |
| `MCP_URL` | Microsoft Learn MCP URL | Remote MCP endpoint |
| `HOST` | `127.0.0.1` | Node API bind address |
| `PORT` | `3000` | Node API port |
| `ALLOWED_ORIGINS` | localhost:8080 origins | Browser CORS allowlist |
| `MAX_TOOL_ITERATIONS` | `8` | Maximum tool-call rounds per user request |
| `REQUEST_TIMEOUT_MS` | `120000` | Outbound request timeout |

## Included local tools

- `get_weather` — Open-Meteo geocoding and current weather
- `domain_name_to_ip` — system DNS lookup
- `codeforces_scan` — Codeforces user profile lookup
- `get_current_time` — timezone-aware date/time
- `calculate` — expression evaluation with `expr-eval` (no JavaScript `eval`)
- `shorten_url` — demo placeholder only; it does not create a real short URL
- `extract_web_content` — public webpage text extraction; blocks local/private network destinations

## How MCP tools are integrated

1. The MCP client connects to the configured remote endpoint over Streamable HTTP.
2. `listTools()` discovers tool names, descriptions and input schemas.
3. The agent maps those schemas into Ollama function-tool definitions using the `mcp__` prefix.
4. When Ollama requests an MCP tool, the dispatcher removes the prefix and calls `client.callTool()`.
5. The returned tool content is added to the conversation and sent back to Ollama for its next response.

MCP schemas describe the remote tool contract; the actual implementation runs on the MCP server.

## Security notes

- Keep `.env` private; it is ignored by Git.
- Do not expose the Node API to the public internet without authentication, rate limiting and a production-grade deployment setup.
- The API binds to `127.0.0.1` by default.
- The webpage extraction tool blocks common private/local network destinations, but this is an experimental safety layer, not a hardened production SSRF proxy.
- Do not add untrusted tools without reviewing their code and permissions.

## GitHub

```bash
git init
git add .
git commit -m "Initial Ollama MCP Agent"
```

Create a GitHub repository named `ollama-mcp-agent`, then add its remote and push your branch.
