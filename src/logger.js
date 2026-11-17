function timestamp() {
  return new Date().toISOString();
}

function write(level, message, meta) {
  const entry = {
    timestamp: timestamp(),
    level,
    message,
    ...(meta === undefined ? {} : { meta })
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

const Logger = {
  log: (message, meta) => write("log", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta),
  tool: (toolName, args) => write("tool", `Executing ${toolName}`, args)
};

export default Logger;
