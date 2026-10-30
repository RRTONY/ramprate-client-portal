import { createClient } from "@/lib/supabase/server";
import {
  addProgress,
  deleteProgress,
  updateProgress,
} from "@/lib/admin-actions";
import { PROGRESS_LABEL } from "@/lib/format";
import { PROGRESS_STATUSES, type ProgressItem } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm } from "@/components/ActionForm";

function StatusSelect({ value }: { value?: string }) {
  return (
    <select name="status" defaultValue={value ?? "upcoming"} className="input">
      {PROGRESS_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PROGRESS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

export default async function AdminProgress({
  params,
}: {
  params: { clientId: string };
}) {
  const { data } = await createClient()
    .from("progress_items")
    .select("*")
    .eq("client_id", params.clientId)
    .order("due_date", { nullsFirst: false });
  const items = (data ?? []) as ProgressItem[];
  const add = addProgress.bind(null, params.clientId);

  return (
    <div className="space-y-6">
      <ActionForm action={add} className="card grid gap-3 sm:grid-cols-6">
        <h2 className="h-section sm:col-span-6 !mb-0">
          Add progress item or next step
        </h2>
        <div className="sm:col-span-3">
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Status</label>
          <StatusSelect />
        </div>
        <div className="sm:col-span-6">
          <label className="label">Detail (client visible)</label>
          <textarea name="detail" rows={2} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Due / completed date</label>
          <input name="due_date" type="date" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Owner</label>
          <input name="owner_name" className="input" />
        </div>
        <div className="flex items-end sm:col-span-2">
          <SubmitButton pendingText="Adding...">Add</SubmitButton>
        </div>
      </ActionForm>

      <div className="space-y-3">
        {items.map((p) => (
          <details key={p.id} className="card !p-0">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <span className="font-semibold">{p.title}</span>
              <span className="text-xs text-slate-500">
                {PROGRESS_LABEL[p.status]}
                {p.due_date ? ` · ${p.due_date}` : ""}
              </span>
            </summary>
            <div className="border-t border-slate-100 p-4">
              <ActionForm
                keepValues
                action={updateProgress.bind(null, params.clientId, p.id)}
                className="grid gap-3 sm:grid-cols-6"
              >
                <div className="sm:col-span-3">
                  <label className="label">Title</label>
                  <input
                    name="title"
                    defaultValue={p.title}
                    required
                    className="input"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="label">Status</label>
                  <StatusSelect value={p.status} />
                </div>
                <div className="sm:col-span-6">
                  <label className="label">Detail</label>
                  <textarea
                    name="detail"
                    defaultValue={p.detail}
                    rows={2}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Date</label>
                  <input
                    name="due_date"
                    type="date"
                    defaultValue={p.due_date ?? ""}
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Owner</label>
                  <input
                    name="owner_name"
                    defaultValue={p.owner_name ?? ""}
                    className="input"
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <SubmitButton>Save</SubmitButton>
                </div>
              </ActionForm>
              <form
                action={deleteProgress.bind(null, params.clientId, p.id)}
                className="mt-3"
              >
                <button className="btn-danger">Delete</button>
              </form>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
