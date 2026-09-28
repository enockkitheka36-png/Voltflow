/**
 * server/index.js — Voltflow 11.x  (InterServer / self-hosted Node API)
 *
 * A tiny zero-extra-dependency Node HTTP server that REUSES the exact same
 * assistant logic as the Vercel serverless function (../api/assistant.js). It
 * wraps Node's http req/res in the small Vercel-style shim the handler expects,
 * so there is ONE source of truth for the assistant — no logic duplication and
 * `api/assistant.js` is left untouched (Vercel keeps working).
 *
 * Security:
 *   - Binds to 127.0.0.1 only; Nginx reverse-proxies /api/ to it.
 *   - ANTHROPIC_API_KEY is read from the server environment only, never sent to
 *     the browser, never logged (the handler already guarantees this).
 *   - If the key is missing the handler returns a safe { configured:false } body,
 *     so the frontend falls back to Project Advisor and keeps working.
 *
 * Run:   PORT=3001 node server/index.js
 * PM2:   pm2 start deploy/interserver/pm2.ecosystem.config.cjs
 */
import http from "node:http";
import fs from "node:fs";
import handler from "../api/assistant.js";
import quoteCalculateHandler from "../api/quotes/calculate.js";

// ── Optional env-file loader (keeps the key OUT of the repo/bundle) ───────────
// Loads KEY=VALUE lines from a root-owned file outside the repo. Never commit it.
const ENV_FILE = process.env.VOLTFLOW_ENV_FILE || "/etc/voltflow/voltflow.env";
try {
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  }
} catch { /* best effort — fall back to process.env */ }

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY = 1_000_000; // 1 MB cap

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY) { data = ""; req.destroy(); resolve(""); }
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

const server = http.createServer(async (req, res) => {
  // Vercel-style response shim expected by api/assistant.js
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.headersSent) res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
    return res;
  };

  const url = req.url || "";

  // Health check for PM2 / Nginx / smoke tests (no secrets leaked).
  if (url === "/api/health" || url === "/health") {
    return res.status(200).json({
      ok: true,
      service: "voltflow-assistant",
      configured: !!process.env.ANTHROPIC_API_KEY, // boolean only — never the key
    });
  }

  // Only the assistant endpoint is proxied through the shared handler.
  if (url.startsWith("/api/assistant")) {
    req.body = await readBody(req); // the handler parses a JSON string
    try {
      await handler(req, res);
    } catch (err) {
      // Log a safe message only — never the key, headers or full error.
      const safe = err && typeof err.message === "string" ? err.message.slice(0, 160) : "unknown error";
      console.error("[voltflow-api] request failed:", safe);
      if (!res.headersSent) res.status(502).json({ configured: true, error: "The AI assistant could not complete that request. Please try again." });
    }
    if (!res.writableEnded) res.end();
    return;
  }

  if (url.startsWith("/api/quotes/calculate")) {
    req.body = await readBody(req);
    try {
      await quoteCalculateHandler(req, res);
    } catch (err) {
      const safe = err && typeof err.message === "string" ? err.message.slice(0, 160) : "unknown error";
      console.error("[voltflow-api] quote request failed:", safe);
      if (!res.headersSent) res.status(500).json({ error: "Quote calculation failed." });
    }
    if (!res.writableEnded) res.end();
    return;
  }

  return res.status(404).json({ error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Voltflow assistant API listening on http://${HOST}:${PORT}  (configured: ${!!process.env.ANTHROPIC_API_KEY})`);
});
