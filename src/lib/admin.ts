import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/verified-user";

export type AdminUser = { id:string; email:string };

/** Read-only page guard; signed claims avoid a remote Auth round trip on every navigation. */
export async function getCurrentAdminForPage(): Promise<AdminUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return null;
  const user = await getVerifiedUser();
  if (!user?.email || user.email.toLowerCase() !== adminEmail) return null;
  return { id:user.id, email:user.email };
}

export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) return null;
  const supabase = await createClient();
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user?.email || user.email.toLowerCase() !== adminEmail) return null;
  return { id:user.id, email:user.email };
}
