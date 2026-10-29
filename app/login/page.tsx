import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";
import { LoginSteps } from "@/components/login/LoginSteps";
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
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-brand-50 to-transparent"
        aria-hidden
      />
      <div className="mb-4 flex justify-center">
        <Logo size={44} />
      </div>
      <LoginSteps
        key={searchParams.reset ? "sent" : "start"}
        initialStep={searchParams.reset ? 3 : 1}
        error={
          searchParams.error
            ? (ERRORS[searchParams.error] ?? "Something went wrong.")
            : undefined
        }
        signIn={signIn}
        sendReset={sendReset}
      />
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
