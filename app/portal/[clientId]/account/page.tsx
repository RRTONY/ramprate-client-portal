import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { setNotifyPreference } from "@/lib/admin-actions";
import { PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export default async function Account() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: row } = await supabase
    .from("profiles")
    .select("notify_email")
    .eq("id", profile.id)
    .single();
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaOn = aal?.nextLevel === "aal2";

  return (
    <>
      <PageTitle
        title="Your account"
        subtitle="Sign-in security and email preferences."
      />
      <div className="grid max-w-3xl gap-6">
        <section className="card">
          <h2 className="h-section">Profile</h2>
          <div className="font-semibold">
            {profile.full_name || profile.email}
          </div>
          <div className="text-sm text-slate-600">{profile.email}</div>
        </section>
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h-section !mb-0">Two-step sign-in</h2>
            <Pill tone={mfaOn ? "green" : "amber"}>{mfaOn ? "On" : "Off"}</Pill>
          </div>
          <p className="mb-3 text-sm text-slate-700">
            Adds a 6 digit code from an authenticator app when you sign in. We
            recommend it, because your portal holds contracts and project
            details.
          </p>
          {!mfaOn && (
            <Link href="/auth/mfa?enroll=1" className="btn">
              Turn on two-step sign-in
            </Link>
          )}
        </section>
        <section className="card">
          <h2 className="h-section">Email notifications</h2>
          <form action={setNotifyPreference} className="space-y-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="notify_email"
                defaultChecked={row?.notify_email ?? true}
                className="mt-1"
              />
              <span>
                Email me when RampRate adds an update or document, and send me a
                short weekly summary.
              </span>
            </label>
            <SubmitButton>Save preference</SubmitButton>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            Replies to your questions are always emailed, whatever you choose
            here.
          </p>
        </section>
      </div>
    </>
  );
}
