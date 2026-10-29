import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { inviteStaffUser, removeStaffUser } from "@/lib/admin-actions";
import { Notice, PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { AccountEditor } from "@/components/AccountEditor";
import { Modal, iconButtonDanger } from "@/components/Modal";
import { FiTrash2, FiUserPlus } from "react-icons/fi";
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
      {searchParams.ok && (
        <Notice kind="success">{OK[searchParams.ok] ?? "Saved."}</Notice>
      )}
      {searchParams.error && (
        <Notice kind="error">
          {ERR[searchParams.error] ?? "Something went wrong. Please try again."}
        </Notice>
      )}
      <div className="mb-4 flex justify-end">
        <Modal
          title="Add a user"
          trigger={
            <>
              <FiUserPlus aria-hidden className="h-4 w-4" />
              Add user
            </>
          }
        >
          <form action={inviteStaffUser} className="space-y-4">
            <div>
              <label className="label" htmlFor="staff-name">Full name</label>
              <input id="staff-name" name="full_name" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="staff-email">Email</label>
              <input id="staff-email" name="email" type="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="staff-role">Role</label>
              <select id="staff-role" name="role" className="input">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <p className="text-sm text-slate-600">
              They sign in with this email and the starting password, then
              choose their own.
            </p>
            <SubmitButton pendingText="Adding..." className="btn w-full">
              Add user
            </SubmitButton>
          </form>
        </Modal>
      </div>
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {((data ?? []) as Profile[]).map((u) => (
          <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="font-semibold">{u.full_name || u.email}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
            <div className="flex items-center gap-2">
              {u.must_change_password && <Pill tone="amber">Starting password</Pill>}
              <Pill tone={u.role === "admin" ? "purple" : "gray"}>
                {u.role}
              </Pill>
              <AccountEditor user={u} back="/admin/users" />
              <form action={removeStaffUser.bind(null, u.id)}>
                <button
                  className={iconButtonDanger}
                  aria-label={`Remove ${u.full_name || u.email}`}
                  title={`Remove ${u.full_name || u.email}`}
                >
                  <FiTrash2 aria-hidden className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
