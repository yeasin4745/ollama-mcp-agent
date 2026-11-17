import Logger from "./src/logger.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("chatForm");
  const sendBtn = document.getElementById("sendBtn");
  const promptInput = document.getElementById("prompt");
  const output = document.getElementById("output");
  const status = document.getElementById("status");

  async function handleSend() {
    const question = promptInput.value.trim();
    if (!question) return;

    sendBtn.disabled = true;
    status.textContent = "Agent is thinking…";
    output.textContent = "Thinking…";
    Logger.info("Sending user query", { characters: question.length });

    try {
      const response = await fetch("http://127.0.0.1:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Backend error ${response.status}`);

      const markdown = typeof marked !== "undefined" ? marked.parse(data.answer || "") : null;
      if (markdown && typeof DOMPurify !== "undefined") {
        output.innerHTML = DOMPurify.sanitize(markdown);
      } else {
        output.textContent = data.answer || "Empty response";
      }
      status.textContent = `Completed · ${data.model || "Ollama"} · ${data.toolIterations ?? 0} tool round(s)`;
      promptInput.value = "";
      Logger.info("Agent response received");
    } catch (error) {
      output.textContent = `Error: ${error.message}`;
      status.textContent = "Request failed";
      Logger.error("Frontend request failed", { message: error.message });
    } finally {
      sendBtn.disabled = false;
      promptInput.focus();
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    handleSend();
  });
  promptInput.addEventListener("keydown", event => {
    if (event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  });

  fetch("http://127.0.0.1:3000/api/health")
    .then(response => response.json())
    .then(data => { status.textContent = `Backend connected · ${data.mcp?.connected ? "MCP connected" : "MCP offline"}`; })
    .catch(() => { status.textContent = "Backend unavailable · start npm run start"; });
});
