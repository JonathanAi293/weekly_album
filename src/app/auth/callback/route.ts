import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const requestedNext = url.searchParams.get("next");
  const fallback = type === "recovery" ? "/auth/update-password" : "/";
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : fallback;
  const response = NextResponse.redirect(new URL(next, url.origin));

  if (code) {
    const { url: supabaseUrl, key } = getSupabaseConfig();
    const supabase = createServerClient(supabaseUrl, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) { items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
      },
    });
    await supabase.auth.exchangeCodeForSession(code);
  }

  return response;
}
