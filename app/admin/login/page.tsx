import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/ui";
import { Logo } from "@/components/Logo";

// Separate sign-in for the RampRate team. Clients who try it are signed straight back out.
async function staffSignIn(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error || !data.user) redirect("/admin/login?error=invalid");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || profile.role === "client") {
    await supabase.auth.signOut();
    redirect("/admin/login?error=notstaff");
  }
  await logEvent({
    action: "auth.login",
    detail: { area: "admin login page", role: profile.role },
  });
  redirect("/admin");
}

const ERRORS: Record<string, string> = {
  invalid: "That email or password is not correct.",
  notstaff:
    "This sign-in is for the RampRate team. Clients, please use the client sign-in.",
};

export default function AdminLogin({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <Logo size={44} onDark />
          </div>
          <h1 className="text-xl font-bold text-white">Portal admin</h1>
          <p className="mt-1 text-sm text-slate-400">
            RampRate team only. Two-step verification is required after sign-in.
          </p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          {searchParams.error && (
            <Notice kind="error">
              {ERRORS[searchParams.error] ?? "Something went wrong."}
            </Notice>
          )}
          <form action={staffSignIn} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="input"
              />
            </div>
            <SubmitButton pendingText="Signing in..." className="btn w-full">
              Sign in to admin
            </SubmitButton>
          </form>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">
          <Link href="/login" className="underline">
            Back to client sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
