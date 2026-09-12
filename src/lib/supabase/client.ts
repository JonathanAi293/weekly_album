"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, key } = getSupabaseConfig();
    // Recovery links are exchanged explicitly on /auth/update-password. Keeping
    // URL detection off here prevents the browser client from racing that page's
    // recovery handler and losing the one-time PKCE code.
    browserClient = createBrowserClient(url, key, {
      auth: { detectSessionInUrl: false },
    });
  }
  return browserClient;
}
