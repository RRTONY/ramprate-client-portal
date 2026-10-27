import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { inviteStaffUser, removeStaffUser } from "@/lib/admin-actions";
import { Notice, PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import type { Profile } from "@/lib/types";

export default async function StaffUsers({
  searchParams,
}: {
  searchParams: { ok?: string; error?: string };
}) {
  await requireAdmin();
  const { data } = await createClient()
    .from("profiles")
    .select("*")
    .in("role", ["staff", "admin"])
    .order("email");
  return (
    <>
      <PageTitle
        title="Staff access"
        subtitle="RampRate users who sign in to the admin console. Staff can edit only the clients you assign to them (see each client's Access tab). Admins can edit everything."
      />
      {searchParams.ok && <Notice kind="success">Invitation sent.</Notice>}
      {searchParams.error && (
        <Notice kind="error">That invitation could not be sent.</Notice>
      )}
      <form
        action={inviteStaffUser}
        className="card mb-6 grid gap-3 sm:grid-cols-6"
      >
        <div className="sm:col-span-2">
          <label className="label">Full name</label>
          <input name="full_name" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Email</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div className="sm:col-span-1">
          <label className="label">Role</label>
          <select name="role" className="input">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-end sm:col-span-1">
          <SubmitButton pendingText="Inviting...">Invite</SubmitButton>
        </div>
      </form>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {((data ?? []) as Profile[]).map((u) => (
          <div key={u.id} className="flex items-center justify-between p-4">
            <div>
              <div className="font-semibold">{u.full_name || u.email}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <div className="flex items-center gap-3">
              <Pill tone={u.role === "admin" ? "purple" : "gray"}>
                {u.role}
              </Pill>
              <form action={removeStaffUser.bind(null, u.id)}>
                <button className="btn-danger">Remove</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
