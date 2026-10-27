import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/ui";

async function setPassword(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 10) redirect("/auth/set-password?error=short");
  if (password !== confirm) redirect("/auth/set-password?error=match");
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/auth/set-password?error=failed");
  redirect("/");
}

const ERRORS: Record<string, string> = {
  short: "Use at least 10 characters.",
  match: "The two passwords do not match.",
  failed: "We could not save that password. Please try again.",
};

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="card">
        <h1 className="mb-1 text-xl font-bold">Set your password</h1>
        <p className="mb-4 text-sm text-slate-600">
          Choose a password to finish setting up your RampRate portal access.
        </p>
        {searchParams.error && (
          <Notice kind="error">{ERRORS[searchParams.error]}</Notice>
        )}
        <form action={setPassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="input"
            />
          </div>
          <SubmitButton className="btn w-full">Save and continue</SubmitButton>
        </form>
      </div>
    </main>
  );
}
