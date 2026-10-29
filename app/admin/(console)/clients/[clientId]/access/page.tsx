import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import {
  assignStaff,
  inviteClientUser,
  revokeClientUser,
  unassignStaff,
} from "@/lib/admin-actions";
import { Notice, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { AccountEditor } from "@/components/AccountEditor";
import type { Profile } from "@/lib/types";

const OK: Record<string, string> = {
  added:
    "User added. Tell them their email and the starting password. They choose their own password at first sign-in.",
  updated: "Details saved.",
  reset: "Password reset to the starting password. They choose a new one at their next sign-in.",
};

const ERR: Record<string, string> = {
  missing: "Enter an email address.",
  invite: "That user could not be added. Check the email address, and whether the person already has an account.",
  update: "Those details could not be saved. The email may already be in use.",
  reset: "The password could not be reset. Please try again.",
};

export default async function AdminAccess({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { error?: string; ok?: string };
}) {
  const me = await requireStaff();
  const supabase = createClient();
  const [{ data: users }, { data: assigned }, { data: staffAll }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("client_id", params.clientId)
        .eq("role", "client")
        .order("email"),
      supabase
        .from("staff_clients")
        .select("user_id, profiles(full_name, email)")
        .eq("client_id", params.clientId),
      me.role === "admin"
        ? supabase
            .from("profiles")
            .select("id, full_name, email")
            .eq("role", "staff")
            .order("email")
        : Promise.resolve({ data: [] }),
    ]);
  const invite = inviteClientUser.bind(null, params.clientId);
  const assign = assignStaff.bind(null, params.clientId);
  const staffRows = (assigned ?? []) as unknown as {
    user_id: string;
    profiles: { full_name: string; email: string } | null;
  }[];

  return (
    <div className="space-y-8">
      {searchParams.error === "notready" && (
        <Notice kind="error">
          This portal is not complete yet, so the client cannot be added.
          Finish the checklist on the Overview tab first.
          {me.role === "admin"
            ? ' As an admin you can tick "Add anyway" below.'
            : ""}
        </Notice>
      )}
      {searchParams.error && searchParams.error !== "notready" && (
        <Notice kind="error">
          {ERR[searchParams.error] ?? "Something went wrong. Please try again."}
        </Notice>
      )}
      {searchParams.ok && (
        <Notice kind="success">{OK[searchParams.ok] ?? "Saved."}</Notice>
      )}

      <section>
        <h2 className="h-section">Client logins</h2>
        <form action={invite} className="card mb-4 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="client-user-name">Full name</label>
            <input id="client-user-name" name="full_name" className="input" />
          </div>
          <div className="sm:col-span-3">
            <label className="label" htmlFor="client-user-email">Email</label>
            <input id="client-user-email" name="email" type="email" required className="input" />
          </div>
          <div className="flex items-end sm:col-span-1">
            <SubmitButton pendingText="Adding..." className="btn w-full">
              Add user
            </SubmitButton>
          </div>
          {me.role === "admin" && (
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-6">
              <input type="checkbox" name="override" /> Add anyway even if
              the portal checklist is incomplete (recorded in the audit log)
            </label>
          )}
        </form>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {((users ?? []) as Profile[]).length === 0 && (
            <div className="p-5 text-sm text-slate-500">
              No client logins yet.
            </div>
          )}
          {((users ?? []) as Profile[]).map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="font-semibold">{u.full_name || u.email}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-3">
                {u.must_change_password && <Pill tone="amber">Starting password</Pill>}
                <form action={revokeClientUser.bind(null, params.clientId, u.id)}>
                  <button className="btn-danger">Remove access</button>
                </form>
              </div>
              {me.role === "admin" && (
                <AccountEditor user={u} back={`/admin/clients/${params.clientId}/access`} />
              )}
            </div>
          ))}
        </div>
      </section>

      {me.role === "admin" && (
        <section>
          <h2 className="h-section">RampRate staff who can edit this portal</h2>
          <form action={assign} className="card mb-4 flex gap-3">
            <select name="user_id" required className="input">
              <option value="">Choose a staff user...</option>
              {(
                (staffAll ?? []) as {
                  id: string;
                  full_name: string;
                  email: string;
                }[]
              ).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
            <SubmitButton pendingText="Adding...">Assign</SubmitButton>
          </form>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
            {staffRows.length === 0 && (
              <div className="p-5 text-sm text-slate-500">
                No staff assigned. Admins can always edit every client.
              </div>
            )}
            {staffRows.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center justify-between p-4"
              >
                <span className="font-semibold">
                  {r.profiles?.full_name || r.profiles?.email}
                </span>
                <form
                  action={unassignStaff.bind(null, params.clientId, r.user_id)}
                >
                  <button className="btn-danger">Unassign</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
