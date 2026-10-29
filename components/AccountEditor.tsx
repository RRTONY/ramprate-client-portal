import { FiEdit2 } from "react-icons/fi";
import { resetUserPassword, updateUserAccount } from "@/lib/admin-actions";
import { SubmitButton } from "@/components/SubmitButton";
import type { Profile } from "@/lib/types";

/** Admin only: edit a person's name and sign-in email, or put them back on the starting password. */
export function AccountEditor({ user, back }: { user: Profile; back: string }) {
  return (
    <details className="group w-full">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 [&::-webkit-details-marker]:hidden">
        <FiEdit2 aria-hidden className="h-4 w-4" />
        Edit
      </summary>
      <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-6">
        <form
          action={updateUserAccount.bind(null, user.id, back)}
          className="grid gap-3 sm:col-span-6 sm:grid-cols-6"
        >
          <div className="sm:col-span-2">
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
          <div className="sm:col-span-3">
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
          <div className="flex items-end sm:col-span-1">
            <SubmitButton pendingText="Saving..." className="btn w-full">
              Save
            </SubmitButton>
          </div>
        </form>
        <form
          action={resetUserPassword.bind(null, user.id, back)}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:col-span-6"
        >
          <p className="text-sm text-slate-600">
            Puts this person back on the starting password. They choose a new
            one at their next sign-in.
          </p>
          <SubmitButton pendingText="Resetting..." className="btn-secondary">
            Reset password
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}
