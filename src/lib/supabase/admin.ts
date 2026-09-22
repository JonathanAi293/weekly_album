import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is required for server-side admin tasks.");
  const { url } = getSupabaseConfig();
  return createClient(url, secretKey, { auth: { autoRefreshToken:false, persistSession:false } });
}
