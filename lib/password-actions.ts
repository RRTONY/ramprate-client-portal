"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

/** Anyone signed in can change their own password, and only their own. */
export async function setOwnPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) redirect("/auth/set-password?error=short");
  if (password !== confirm) redirect("/auth/set-password?error=match");
  if (password === process.env.DEFAULT_USER_PASSWORD)
    redirect("/auth/set-password?error=default");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/set-password?error=failed");

  // People cannot edit their own profile row, so the starting-password flag is cleared with the
  // service key, and only after Supabase accepted the new password.
  await createServiceClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);
  await logEvent({ action: "auth.password_change", entity: "profile", entityId: user.id });
  redirect("/");
}
