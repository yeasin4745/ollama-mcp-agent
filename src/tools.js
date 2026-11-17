// Local tool schemas exposed to Ollama. MCP schemas are discovered dynamically.
export const availableTools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather information for a city worldwide.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City name, e.g. Dhaka" } },
        required: ["city"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "domain_name_to_ip",
      description: "Resolve a domain name using Google's public DNS-over-HTTPS API.",
      parameters: {
        type: "object",
        properties: { domain: { type: "string", description: "Domain, e.g. example.com" } },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "codeforces_scan",
      description: "Look up a Codeforces user profile and rating information.",
      parameters: {
        type: "object",
        properties: { username: { type: "string", description: "Codeforces handle" } },
        required: ["username"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current date and time in an IANA timezone.",
      parameters: {
        type: "object",
        properties: { timezone: { type: "string", description: "Timezone, e.g. Asia/Dhaka" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description: "Safely evaluate a basic mathematical expression. No JavaScript is executed.",
      parameters: {
        type: "object",
        properties: { expression: { type: "string", description: "Math expression, e.g. (10-5)/3 or sqrt(81)" } },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "shorten_url",
      description: "Demonstration-only URL shortener. It returns a clearly labelled mock result and does not create a real short link.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "HTTP or HTTPS URL" } },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_web_content",
      description: "Fetch a public HTTP/HTTPS webpage and extract readable text. Private/local network addresses are blocked.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "Public webpage URL" },
          selector: { type: "string", description: "Optional CSS selector; defaults to body" }
        },
        required: ["url"]
      }
    }
  }
];
