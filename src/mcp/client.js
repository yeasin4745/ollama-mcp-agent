import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import Logger from "../logger.js";

const MCP_URL = process.env.MCP_URL || "https://learn.microsoft.com/api/mcp";
let client = null;
let tools = [];
let connected = false;

export async function connectMCP() {
  if (connected && client) return tools;
  const nextClient = new Client({ name: "ollama-mcp-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  try {
    await nextClient.connect(transport);
    const result = await nextClient.listTools();
    client = nextClient;
    tools = result.tools || [];
    connected = true;
    Logger.info("MCP connected", { url: MCP_URL, toolCount: tools.length, tools: tools.map(t => t.name) });
    return tools;
  } catch (error) {
    try { await nextClient.close(); } catch {}
    connected = false;
    client = null;
    tools = [];
    Logger.error("MCP connection failed", { message: error.message });
    throw error;
  }
}

export function getMCPStatus() {
  return { enabled: process.env.MCP_ENABLED !== "false", connected, url: MCP_URL, toolCount: tools.length, tools: tools.map(t => t.name) };
}

export function getMCPTools() {
  return tools;
}

export async function executeMCPTool(name, args) {
  if (!client || !connected) throw new Error("MCP server is not connected");
  const result = await client.callTool({ name, arguments: args ?? {} });
  if (result.isError) {
    const details = (result.content || []).map(item => item.text || "").join("\n");
    throw new Error(details || `MCP tool ${name} failed`);
  }
  if (result.structuredContent !== undefined) return result.structuredContent;
  return result.content || [];
}

export async function disconnectMCP() {
  if (client) {
    await client.close();
    client = null;
  }
  connected = false;
  tools = [];
  Logger.info("MCP disconnected");
}
