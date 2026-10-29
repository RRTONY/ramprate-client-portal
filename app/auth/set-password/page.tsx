import Link from "next/link";
import { setOwnPassword } from "@/lib/password-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Notice } from "@/components/ui";

const ERRORS: Record<string, string> = {
  short: "Use at least 10 characters.",
  match: "The two passwords do not match.",
  failed: "We could not save that password. Please try again.",
  default: "Choose a password that is different from the starting password.",
};

export default function SetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; first?: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="card">
        <h1 className="mb-1 text-xl font-bold">Set your password</h1>
        <p className="mb-4 text-sm text-slate-600">
          {searchParams.first
            ? "You signed in with the starting password. Choose your own password to continue."
            : "Choose a new password for your RampRate portal account."}
        </p>
        {searchParams.error && (
          <Notice kind="error">{ERRORS[searchParams.error]}</Notice>
        )}
        <form action={setOwnPassword} className="space-y-4">
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
        {!searchParams.first && (
          <Link
            href="/"
            className="mt-4 block text-center text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Back to my dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
