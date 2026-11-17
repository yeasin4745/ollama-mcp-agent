import "dotenv/config";
import { connectMCP, disconnectMCP } from "./client.js";

try {
  const tools = await connectMCP();
  console.log("\nMicrosoft Learn MCP tools discovered:\n");
  for (const tool of tools) {
    console.log(`- ${tool.name}: ${tool.description || "No description"}`);
    console.log(JSON.stringify(tool.inputSchema || {}, null, 2));
  }
  if (tools.length === 0) console.log("Connected, but the server returned no tools.");
} catch (error) {
  console.error("MCP connection test failed:", error.message);
  process.exitCode = 1;
} finally {
  await disconnectMCP().catch(() => {});
}
