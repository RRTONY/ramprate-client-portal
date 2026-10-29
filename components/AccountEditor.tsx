import { FiEdit2 } from "react-icons/fi";
import { resetUserPassword, updateUserAccount } from "@/lib/admin-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Modal, iconButton } from "@/components/Modal";
import type { Profile } from "@/lib/types";

/** Admin only: edit a person's name and sign-in email, or put them back on the starting password. */
export function AccountEditor({ user, back }: { user: Profile; back: string }) {
  const who = user.full_name || user.email;
  return (
    <Modal
      title={`Edit ${who}`}
      trigger={<FiEdit2 aria-hidden className="h-4 w-4" />}
      triggerLabel={`Edit ${who}`}
      triggerClassName={iconButton}
    >
      <form action={updateUserAccount.bind(null, user.id, back)} className="space-y-4">
        <div>
          <label className="label" htmlFor={`name-${user.id}`}>
            Full name
          </label>
          <input
            id={`name-${user.id}`}
            name="full_name"
            defaultValue={user.full_name}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor={`email-${user.id}`}>
            Email
          </label>
          <input
            id={`email-${user.id}`}
            name="email"
            type="email"
            required
            defaultValue={user.email}
            className="input"
          />
        </div>
        <SubmitButton pendingText="Saving..." className="btn w-full">
          Save changes
        </SubmitButton>
      </form>
      <form
        action={resetUserPassword.bind(null, user.id, back)}
        className="mt-5 space-y-3 border-t border-slate-100 pt-4"
      >
        <p className="text-sm text-slate-600">
          Puts this person back on the starting password. They choose a new one
          at their next sign-in.
        </p>
        <SubmitButton pendingText="Resetting..." className="btn-secondary w-full">
          Reset password
        </SubmitButton>
      </form>
    </Modal>
  );
}
