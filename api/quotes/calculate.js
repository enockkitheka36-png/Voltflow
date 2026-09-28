import { calculateQuote } from "../../src/utils/quoteEngine.js";
import { AssistantAuthError, verifyAssistantAccess } from "../assistantAuth.js";

const MAX_LINES = 500;

export function calculateQuoteRequest(body = {}) {
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) throw new RangeError("At least one quote line is required.");
  if (lines.length > MAX_LINES) throw new RangeError(`Quote line count cannot exceed ${MAX_LINES}.`);
  return calculateQuote(
    lines,
    { ...(body.pricingPolicy || {}), currency: body.currency || body.pricingPolicy?.currency || "KES" },
    body.taxPolicy,
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    await verifyAssistantAccess(req, body);
    return res.status(200).json(calculateQuoteRequest(body));
  } catch (error) {
    if (error instanceof AssistantAuthError) return res.status(error.status).json({ error: error.message });
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Request body must be valid JSON." });
    if (error instanceof RangeError || error instanceof TypeError) return res.status(422).json({ error: error.message });
    return res.status(500).json({ error: "Quote calculation failed." });
  }
}
