import Link from "next/link";
import { FiLock } from "react-icons/fi";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { setNotifyPreference } from "@/lib/admin-actions";
import { PageTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export default async function Account() {
  const profile = await requireProfile();
  const supabase = createClient();
  const { data: row } = await supabase
    .from("profiles")
    .select("notify_email")
    .eq("id", profile.id)
    .single();

  return (
    <>
      <PageTitle
        title="Your account"
        subtitle="Your profile and email preferences."
      />
      <div className="grid max-w-3xl gap-6">
        <section className="card">
          <h2 className="h-section">Profile</h2>
          <div className="font-semibold">
            {profile.full_name || profile.email}
          </div>
          <div className="text-sm text-slate-600">{profile.email}</div>
          <Link href="/auth/set-password" className="btn-secondary mt-4 inline-flex">
            <FiLock aria-hidden className="h-4 w-4" />
            Change password
          </Link>
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
