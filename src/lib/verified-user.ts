import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Verify the signed JWT once per Server Component request. Mutations still use getUser(). */
export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : null };
});
