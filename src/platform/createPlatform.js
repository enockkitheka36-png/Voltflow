import { createClient } from "@supabase/supabase-js";
import { resolvePlatformConfig, EVIDENCE_BUCKET } from "./config.js";
import { createLocalDemoPlatform } from "./localDemoAdapter.js";
import { createSupabasePlatform } from "./supabaseAdapter.js";
import { createCatalystPlatform } from "./catalystAdapter.js";

// When the app is served from the hosted Catalyst domain we always use the
// Catalyst provider (Zoho login + DataStore), regardless of build-time env, so
// a single build works both on Catalyst and on localhost (local-demo).
function detectHostedCatalyst() {
  if (typeof window === "undefined") return false;
  return /catalystserverless\.com$/.test(window.location.hostname)
    || /\.catalyst\.zoho\./.test(window.location.hostname);
}

export function createVoltflowPlatform(options = {}) {
  const config = detectHostedCatalyst()
    ? { mode: "catalyst", cloudEnabled: true, authRequired: true, evidenceBucket: EVIDENCE_BUCKET }
    : resolvePlatformConfig(options.env || {});
  if (config.mode === "catalyst") {
    return { config, platform: createCatalystPlatform({ storage: options.storage }) };
  }
  if (config.mode === "local-demo") {
    return { config, platform: createLocalDemoPlatform({ storage: options.storage, role: config.localRole }) };
  }
  const client = options.supabaseClient || createClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: {
        headers: { "X-Voltflow-Client": "11.8-trust-foundation" },
      },
    },
  );
  return { config, platform: createSupabasePlatform(client, { evidenceBucket: config.evidenceBucket }), client };
}
