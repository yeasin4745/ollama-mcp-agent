import dns from "node:dns/promises";
import net from "node:net";
import { Parser } from "expr-eval";
import * as cheerio from "cheerio";

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

async function fetchJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "ollama-mcp-agent/1.0" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function getWeatherService({ city }) {
  if (!city?.trim()) throw new Error("city is required");
  const geo = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const place = geo.results?.[0];
  if (!place) return { error: "Location not found" };

  const weather = await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m`);
  return {
    location: `${place.name}, ${place.country}`,
    timezone: weather.timezone,
    current: weather.current
  };
}

export async function domainToIP({ domain }) {
  const hostname = String(domain || "").trim().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  if (!hostname || hostname.length > 253) throw new Error("A valid domain is required");
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return { domain: hostname, addresses: records };
}

export async function codeForceScan({ username }) {
  if (!username?.trim()) throw new Error("username is required");
  return fetchJson(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(username.trim())}`);
}

export async function getCurrentTime({ timezone = "Asia/Dhaka" } = {}) {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  }).format(now);
  return { timezone, dateTime: formatted, iso: now.toISOString() };
}

const mathParser = new Parser({
  operators: { assignment: false, concatenate: false, conditional: false, logical: false, comparison: false, in: false }
});

export async function calculate({ expression }) {
  if (typeof expression !== "string" || !expression.trim()) throw new Error("expression is required");
  if (expression.length > 200) throw new Error("Expression is too long");
  const result = mathParser.evaluate(expression);
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("Expression did not produce a finite number");
  return { expression, result };
}

export async function shorten_url({ url }) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Only HTTP and HTTPS URLs are supported");
  return {
    status: "demo_only",
    original: parsed.href,
    message: "No real short link was created. Connect a URL-shortening provider to enable this feature."
  };
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) return isPrivateIPv4(address);
  if (net.isIPv6(address)) {
    const value = address.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:") || value.startsWith("::ffff:127.");
  }
  return true;
}

async function validatePublicUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Only HTTP and HTTPS URLs are allowed");
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Local network URLs are blocked");
  const addresses = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error("Private or local network destinations are blocked");
  return url;
}

export async function extract_web_content({ url: rawUrl, selector = "body" }) {
  if (!rawUrl) throw new Error("url is required");
  const url = await validatePublicUrl(rawUrl);
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "ollama-mcp-agent/1.0", "Accept": "text/html,application/xhtml+xml" }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    throw new Error("The URL did not return an HTML document");
  }
  const html = await response.text();
  if (html.length > 1_000_000) throw new Error("Webpage is larger than the 1 MB extraction limit");
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer").remove();
  let target;
  try { target = $(selector || "body").first(); }
  catch { throw new Error("Invalid CSS selector"); }
  return {
    url: url.href,
    title: $("title").first().text().trim(),
    selector: selector || "body",
    text: (target.length ? target.text() : $("body").text()).replace(/\s+/g, " ").trim().slice(0, 12000)
  };
}

export const localToolFunctions = {
  get_weather: getWeatherService,
  domain_name_to_ip: domainToIP,
  codeforces_scan: codeForceScan,
  get_current_time: getCurrentTime,
  calculate,
  shorten_url,
  extract_web_content
};
