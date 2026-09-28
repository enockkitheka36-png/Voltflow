import { createClient } from "@supabase/supabase-js";
import { resolvePlatformConfig } from "./config.js";
import { createLocalDemoPlatform } from "./localDemoAdapter.js";
import { createSupabasePlatform } from "./supabaseAdapter.js";

export function createVoltflowPlatform(options = {}) {
  const config = resolvePlatformConfig(options.env || {});
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
