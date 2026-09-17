import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AdminUser = { id:string; email:string };

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return null;
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.toLowerCase() !== adminEmail) return null;
  return { id:user.id, email:user.email };
}
