import "dotenv/config";
import http from "node:http";
import Logger from "./logger.js";
import { runAgentWorkflow, getAgentStatus } from "./help.js";
import { connectMCP, disconnectMCP, getMCPStatus } from "./mcp/client.js";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const MCP_ENABLED = process.env.MCP_ENABLED !== "false";
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || "http://127.0.0.1:8080,http://localhost:8080").split(",").map(x => x.trim()).filter(Boolean));
const MAX_BODY_BYTES = 100 * 1024;

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { statusCode: 413 });
  }
  try { return JSON.parse(body || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 }); }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const path = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`).pathname;
  if (req.method === "GET" && path === "/api/health") {
    return sendJson(res, 200, { status: "ok", ...getAgentStatus() });
  }
  if (req.method === "POST" && path === "/api/chat") {
    try {
      const { question } = await readJson(req);
      if (typeof question !== "string" || !question.trim()) return sendJson(res, 400, { error: "A non-empty question is required" });
      const result = await runAgentWorkflow(question);
      return sendJson(res, 200, result);
    } catch (error) {
      Logger.error("Chat request failed", { message: error.message });
      return sendJson(res, error.statusCode || 500, { error: error.message });
    }
  }
  return sendJson(res, 404, { error: "Not found" });
});

async function start() {
  if (MCP_ENABLED) {
    try { await connectMCP(); }
    catch (error) { Logger.warn("Starting without MCP; local tools remain available", { message: error.message }); }
  } else {
    Logger.info("MCP integration is disabled by configuration");
  }

  server.listen(PORT, HOST, () => Logger.info("Agent API listening", { url: `http://${HOST}:${PORT}` }));
}

async function shutdown(signal) {
  Logger.info("Shutting down", { signal });
  server.close(async () => {
    try { await disconnectMCP(); } catch (error) { Logger.warn("MCP shutdown warning", { message: error.message }); }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch(error => {
  Logger.error("Server startup failed", { message: error.message });
  process.exit(1);
});
