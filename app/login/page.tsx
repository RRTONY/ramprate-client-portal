import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { SocialLinks } from "@/components/SocialLinks";
import { AuthHashForward } from "@/components/AuthFinish";

async function signIn(formData: FormData) {
  "use server";
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=invalid");
  await logEvent({
    action: "auth.login",
    detail: { area: "client login page" },
  });
  redirect("/");
}

async function sendReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const supabase = createClient();
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${site}/auth/confirm?next=/auth/set-password`,
    });
  }
  redirect("/login?reset=1");
}

const ERRORS: Record<string, string> = {
  invalid: "That email or password is not correct.",
  "no-profile":
    "Your account is not set up yet. Please contact your RampRate engagement owner.",
  "no-client":
    "Your account is not linked to a client portal yet. Please contact RampRate.",
  link: "That link has expired. Please request a new one.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; reset?: string };
}) {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <AuthHashForward />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-brand-50 to-transparent"
        aria-hidden
      />
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <Logo size={44} />
        </div>
        <h1 className="text-3xl font-bold">Welcome back</h1>
        <p className="mt-2 text-[15px] text-slate-600">
          Sign in to your RampRate client portal to see where your engagement
          stands.
        </p>
      </div>
      <div className="card">
        {searchParams.error && (
          <Notice kind="error">
            {ERRORS[searchParams.error] ?? "Something went wrong."}
          </Notice>
        )}
        {searchParams.reset && (
          <Notice kind="success">
            If that email has an account, a reset link is on its way.
          </Notice>
        )}
        <form action={signIn} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
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
            Sign in
          </SubmitButton>
        </form>
        <details className="mt-5 text-sm">
          <summary className="cursor-pointer text-brand-700">
            Forgot your password?
          </summary>
          <form action={sendReset} className="mt-3 flex gap-2">
            <input
              name="email"
              type="email"
              required
              placeholder="you@company.com"
              className="input"
            />
            <SubmitButton className="btn-secondary" pendingText="Sending...">
              Send link
            </SubmitButton>
          </form>
        </details>
      </div>
      <div className="mt-6 flex flex-col items-center gap-3 text-xs text-slate-500">
        <p>Need access? Contact your RampRate engagement owner.</p>
        <SocialLinks />
        <p>
          <Link href="/privacy" className="underline">
            Privacy and security
          </Link>
          {" · "}
          <Link href="/admin/login" className="underline">
            RampRate team sign-in
          </Link>
        </p>
      </div>
    </main>
  );
}
