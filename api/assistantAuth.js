import { createClient } from "@supabase/supabase-js";

const INTERNAL_ASSISTANT_ROLES = new Set(["manager", "engineer", "sales"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AssistantAuthError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "AssistantAuthError";
    this.status = status;
  }
}

function jwtRole(value) {
  try {
    const payload = String(value || "").split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(normalized, "base64").toString("utf8"))?.role || null;
  } catch {
    return null;
  }
}

export function assistantAuthRequired(env = process.env) {
  const explicit = String(env.VOLTFLOW_REQUIRE_AUTH || "").trim().toLowerCase();
  if (["1", "true", "yes"].includes(explicit)) return true;
  if (["0", "false", "no"].includes(explicit)) return false;
  return !!(env.SUPABASE_URL && (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY));
}

export function extractBearerToken(headers = {}) {
  const value = String(headers.authorization || headers.Authorization || "").trim();
  const match = value.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || null;
}

export async function verifyAssistantAccess(req, body, options = {}) {
  const env = options.env || process.env;
  if (!assistantAuthRequired(env)) return { required: false, userId: null, role: null };

  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !publishableKey) throw new AssistantAuthError(503, "Assistant authentication is not configured.");
  if (["service_role", "supabase_admin"].includes(jwtRole(publishableKey))) {
    throw new AssistantAuthError(503, "Elevated Supabase credentials are prohibited for this endpoint.");
  }

  const token = extractBearerToken(req?.headers || {});
  if (!token) throw new AssistantAuthError(401, "Authentication required.");
  const organisationId = String(body?.organisationId || "").trim();
  if (!UUID_RE.test(organisationId)) throw new AssistantAuthError(400, "A valid organisation is required.");

  const create = options.createClient || createClient;
  const client = create(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user?.id) throw new AssistantAuthError(401, "Authentication session is invalid or expired.");
  const { data: membership, error: membershipError } = await client
    .from("organisation_memberships")
    .select("role,status")
    .eq("organisation_id", organisationId)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) throw new AssistantAuthError(403, "Active organisation membership required.");
  if (!INTERNAL_ASSISTANT_ROLES.has(membership.role)) throw new AssistantAuthError(403, "This role cannot use the internal assistant.");
  return { required: true, userId: userData.user.id, role: membership.role, organisationId };
}
