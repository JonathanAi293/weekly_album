import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "./config";
import { auditStep, auditedFetch } from "@/lib/perf-audit";

export async function updateSession(request: NextRequest) {
  if (process.env.PERF_AUDIT === "1") console.info(`[perf] request ${request.nextUrl.pathname} rsc=${request.nextUrl.searchParams.has("_rsc") || request.headers.get("rsc") === "1"} accept=${request.headers.get("accept")?.split(",")[0] ?? ""} prefetch=${request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch"}`);
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    global: { fetch: auditedFetch },
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await auditStep("proxy getClaims", () => supabase.auth.getClaims());
  return response;
}
