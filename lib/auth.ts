import { redirect } from "next/navigation";
import { cache } from "@/lib/request-cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/**
 * Returns the signed-in user's profile, or redirects to /login. Shared within one request, so a
 * layout and its page check the session once instead of twice.
 */
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login?error=no-profile");
  if (profile.must_change_password) redirect("/auth/set-password?first=1");
  return profile as Profile;
});

export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role === "client") redirect("/");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/admin");
  return profile;
}

/** Throws unless the user may manage this client. Use inside server actions. */
export async function assertCanManage(clientId: string): Promise<Profile> {
  const profile = await requireStaff();
  if (profile.role === "admin") return profile;
  const supabase = createClient();
  const { data } = await supabase
    .from("staff_clients")
    .select("client_id")
    .eq("user_id", profile.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) throw new Error("You do not have access to manage this client.");
  return profile;
}
