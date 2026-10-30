import { createClient } from "@/lib/supabase/server";
import { addUpdate, deleteUpdate, toggleUpdate } from "@/lib/admin-actions";
import { fmtDate, KIND_LABEL } from "@/lib/format";
import { UPDATE_KINDS, type UpdateRow } from "@/lib/types";
import { Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm } from "@/components/ActionForm";

export default async function AdminUpdates({
  params,
}: {
  params: { clientId: string };
}) {
  const { data } = await createClient()
    .from("updates")
    .select("*")
    .eq("client_id", params.clientId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  const updates = (data ?? []) as UpdateRow[];
  const add = addUpdate.bind(null, params.clientId);

  return (
    <div className="space-y-6">
      <ActionForm action={add} className="card grid gap-3 sm:grid-cols-6">
        <h2 className="h-section sm:col-span-6 !mb-0">Post an update</h2>
        <div className="sm:col-span-3">
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Type</label>
          <select name="kind" className="input">
            {UPDATE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="label">Date</label>
          <input name="occurred_on" type="date" className="input" />
        </div>
        <div className="sm:col-span-6">
          <label className="label">Details</label>
          <textarea name="body" rows={3} className="input" />
        </div>
        <div className="space-y-1 text-sm sm:col-span-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" defaultChecked /> Visible to
            the client now (untick to save as a draft)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="notify" /> Email the
            client about this (Sam is CC'd)
          </label>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <SubmitButton pendingText="Posting...">Post update</SubmitButton>
        </div>
      </ActionForm>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {updates.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Pill>{KIND_LABEL[u.kind]}</Pill>
                {!u.published && <Pill tone="amber">Draft</Pill>}
                <span className="text-xs text-slate-500">
                  {fmtDate(u.occurred_on)}
                </span>
              </div>
              <div className="font-semibold">{u.title}</div>
              {u.body && (
                <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                  {u.body}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <form
                action={toggleUpdate.bind(
                  null,
                  params.clientId,
                  u.id,
                  !u.published,
                )}
              >
                <button className="btn-secondary !py-1.5 !text-xs">
                  {u.published ? "Unpublish" : "Publish"}
                </button>
              </form>
              <form action={deleteUpdate.bind(null, params.clientId, u.id)}>
                <button className="btn-danger">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
