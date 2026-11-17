import { availableTools } from "./tools.js";
import { localToolFunctions } from "./function_call.js";
import Logger from "./logger.js";
import { executeMCPTool, getMCPTools, getMCPStatus } from "./mcp/client.js";

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:0.5b";
const MAX_TOOL_ITERATIONS = Number(process.env.MAX_TOOL_ITERATIONS || 8);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

function convertMCPTools(mcpTools) {
  return mcpTools.map(tool => ({
    type: "function",
    function: {
      name: `mcp__${tool.name}`,
      description: tool.description || `MCP tool ${tool.name}`,
      parameters: tool.inputSchema || { type: "object", properties: {} }
    }
  }));
}

export function getAvailableTools() {
  return [...availableTools, ...convertMCPTools(getMCPTools())];
}

async function callOllamaModel(messages, tools) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools, stream: false }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Ollama API error (${response.status}): ${await response.text()}`);
  const data = await response.json();
  if (!data.message) throw new Error("Ollama returned an invalid chat response");
  return data.message;
}

function normalizeArguments(args) {
  if (typeof args === "string") {
    try { return JSON.parse(args); }
    catch { throw new Error("Model returned invalid JSON tool arguments"); }
  }
  return args && typeof args === "object" ? args : {};
}

export async function dispatchTool(toolName, rawArgs) {
  const args = normalizeArguments(rawArgs);
  if (Object.hasOwn(localToolFunctions, toolName)) {
    return localToolFunctions[toolName](args);
  }
  if (toolName.startsWith("mcp__")) {
    const originalName = toolName.slice("mcp__".length);
    if (!getMCPTools().some(tool => tool.name === originalName)) {
      throw new Error(`Unknown MCP tool: ${originalName}`);
    }
    return executeMCPTool(originalName, args);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

export async function runAgentWorkflow(userQuestion) {
  if (typeof userQuestion !== "string" || !userQuestion.trim()) throw new Error("A non-empty question is required");
  const tools = getAvailableTools();
  const messages = [
    {
      role: "system",
      content: "You are a helpful AI assistant. Use available tools when they are useful. Explain tool results accurately. Never claim a tool succeeded if it returned an error."
    },
    { role: "user", content: userQuestion.trim() }
  ];

  let assistantMessage = await callOllamaModel(messages, tools);
  let iteration = 0;

  while (Array.isArray(assistantMessage.tool_calls) && assistantMessage.tool_calls.length > 0) {
    if (iteration >= MAX_TOOL_ITERATIONS) throw new Error(`Maximum tool-call iterations (${MAX_TOOL_ITERATIONS}) reached`);
    iteration += 1;
    messages.push(assistantMessage);

    for (const call of assistantMessage.tool_calls) {
      const name = call.function?.name;
      const args = call.function?.arguments;
      if (!name) continue;
      Logger.tool(name, args);
      let content;
      try {
        const result = await dispatchTool(name, args);
        content = typeof result === "string" ? result : JSON.stringify(result);
        Logger.info("Tool completed", { name });
      } catch (error) {
        content = JSON.stringify({ error: error.message, tool: name });
        Logger.error("Tool execution failed", { name, message: error.message });
      }
      messages.push({ role: "tool", content });
    }
    assistantMessage = await callOllamaModel(messages, tools);
  }

  return {
    answer: assistantMessage.content || "The model returned an empty response.",
    model: OLLAMA_MODEL,
    toolIterations: iteration
  };
}

export function getAgentStatus() {
  return { model: OLLAMA_MODEL, ollamaBaseUrl: OLLAMA_BASE_URL, mcp: getMCPStatus(), localToolCount: availableTools.length };
}
