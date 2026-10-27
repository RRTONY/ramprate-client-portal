import { createClient } from "@/lib/supabase/server";
import {
  addMeeting,
  deleteMeeting,
  updateMeetingNotes,
} from "@/lib/admin-actions";
import { fmtDateTime } from "@/lib/format";
import type { Meeting } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AdminMeetings({
  params,
}: {
  params: { clientId: string };
}) {
  const { data } = await createClient()
    .from("meetings")
    .select("*")
    .eq("client_id", params.clientId)
    .order("starts_at", { ascending: false });
  const meetings = (data ?? []) as Meeting[];
  const add = addMeeting.bind(null, params.clientId);

  return (
    <div className="space-y-6">
      <form action={add} className="card grid gap-3 sm:grid-cols-6">
        <h2 className="h-section sm:col-span-6 !mb-0">Schedule a meeting</h2>
        <div className="sm:col-span-3">
          <label className="label">Title</label>
          <input name="title" required className="input" />
        </div>
        <div className="sm:col-span-3">
          <label className="label">Date and time (Pacific Time)</label>
          <input
            name="starts_at"
            type="datetime-local"
            required
            className="input"
          />
        </div>
        <div className="sm:col-span-6">
          <label className="label">Meeting link or location</label>
          <input name="location" className="input" placeholder="https://..." />
        </div>
        <div className="sm:col-span-6">
          <label className="label">Agenda</label>
          <textarea name="agenda" rows={3} className="input" />
        </div>
        <div className="sm:col-span-6">
          <SubmitButton pendingText="Adding...">Add meeting</SubmitButton>
        </div>
      </form>

      <div className="space-y-3">
        {meetings.map((m) => (
          <details key={m.id} className="card !p-0">
            <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
              <span className="font-semibold">{m.title}</span>
              <span className="text-xs text-slate-500">
                {fmtDateTime(m.starts_at)}
              </span>
            </summary>
            <div className="border-t border-slate-100 p-4">
              <form
                action={updateMeetingNotes.bind(null, params.clientId, m.id)}
                className="space-y-3"
              >
                <div>
                  <label className="label">Link or location</label>
                  <input
                    name="location"
                    defaultValue={m.location ?? ""}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Agenda</label>
                  <textarea
                    name="agenda"
                    defaultValue={m.agenda}
                    rows={3}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">
                    Notes and outcomes (shown after the meeting)
                  </label>
                  <textarea
                    name="notes"
                    defaultValue={m.notes}
                    rows={3}
                    className="input"
                  />
                </div>
                <SubmitButton>Save</SubmitButton>
              </form>
              <form
                action={deleteMeeting.bind(null, params.clientId, m.id)}
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
