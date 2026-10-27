import { createClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/data";
import { deleteClientAction, updateClientAction } from "@/lib/admin-actions";
import { getReadiness } from "@/lib/readiness";
import { requireStaff } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";
import type { TeamMember } from "@/lib/types";

export default async function AdminOverview({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { error?: string };
}) {
  const me = await requireStaff();
  const client = await getClientOr404(params.clientId);
  const readiness = await getReadiness(client);
  const remove = deleteClientAction.bind(null, client.id);
  const { data } = await createClient()
    .from("team_members")
    .select("*")
    .eq("active", true)
    .order("full_name");
  const team = (data ?? []) as TeamMember[];
  const save = updateClientAction.bind(null, client.id);

  return (
    <div className="space-y-6">
      {searchParams.error === "confirm" && (
        <Notice kind="error">
          The name you typed did not match, so nothing was deleted.
        </Notice>
      )}
      <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
        <section className="card lg:order-2">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="h-section !mb-0">Ready for the client?</h2>
            <span className="text-sm font-semibold">
              {readiness.done}/{readiness.items.length}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${readiness.ready ? "bg-emerald-500" : "bg-brand-500"}`}
              style={{
                width: `${(readiness.done / readiness.items.length) * 100}%`,
              }}
            />
          </div>
          <ul className="space-y-1.5 text-sm">
            {readiness.items.map((i) => (
              <li key={i.key} className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${i.ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {i.ok ? "✓" : "!"}
                </span>
                <span className={i.ok ? "text-slate-600" : "font-medium"}>
                  {i.label}
                  {!i.ok && <span className="text-slate-400"> ({i.hint})</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {readiness.ready
              ? "Complete. This portal can be shared with the client."
              : "A portal must be complete before the client is invited, so they never see blank sections."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Last updated {fmtDate(client.last_updated_at)}
          </p>
        </section>
        <form action={save} className="card space-y-4 lg:order-1 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Client name
              </label>
              <input
                id="name"
                name="name"
                defaultValue={client.name}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="status">
                Status line shown to client
              </label>
              <input
                id="status"
                name="status"
                defaultValue={client.status}
                className="input"
                placeholder="e.g. Active, Phase 2 build"
              />
            </div>
            <div>
              <label className="label" htmlFor="next_update_due">
                Next update due (shown to client)
              </label>
              <input
                id="next_update_due"
                name="next_update_due"
                type="date"
                defaultValue={client.next_update_due ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="health">
                Health
              </label>
              <select
                id="health"
                name="health"
                defaultValue={client.health}
                className="input"
              >
                <option value="on_track">On track</option>
                <option value="needs_attention">Needs attention</option>
                <option value="at_risk">At risk</option>
                <option value="on_hold">On hold</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="slack_channel">
                Slack channel (internal reference)
              </label>
              <input
                id="slack_channel"
                name="slack_channel"
                defaultValue={client.slack_channel ?? ""}
                placeholder="#ext-cl-clientname"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="engagement_owner_id">
                Engagement owner (gets query emails)
              </label>
              <select
                id="engagement_owner_id"
                name="engagement_owner_id"
                defaultValue={client.engagement_owner_id ?? ""}
                className="input"
              >
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="spoc_id">
                Client SPOC
              </label>
              <select
                id="spoc_id"
                name="spoc_id"
                defaultValue={client.spoc_id ?? ""}
                className="input"
              >
                <option value="">Unassigned</option>
                {team.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="welcome_note">
              Personal welcome note from the engagement owner (optional, shown
              at the top of the overview)
            </label>
            <textarea
              id="welcome_note"
              name="welcome_note"
              defaultValue={client.welcome_note ?? ""}
              rows={3}
              maxLength={500}
              className="input"
              placeholder="Welcome aboard. I am looking forward to working with you..."
            />
          </div>
          <div>
            <label className="label" htmlFor="summary">
              What we are working on
            </label>
            <textarea
              id="summary"
              name="summary"
              defaultValue={client.summary}
              rows={4}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="approach">
              Our approach
            </label>
            <textarea
              id="approach"
              name="approach"
              defaultValue={client.approach}
              rows={4}
              className="input"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="phases">
                Engagement phases (one per line, shown as a timeline)
              </label>
              <textarea
                id="phases"
                name="phases"
                defaultValue={(client.phases ?? []).join("\n")}
                rows={4}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="current_phase">
                Current phase
              </label>
              <select
                id="current_phase"
                name="current_phase"
                defaultValue={String(client.current_phase ?? 0)}
                className="input"
              >
                {(client.phases ?? []).map((ph, i) => (
                  <option key={i} value={i}>
                    {ph}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Save the phase list first, then pick the current phase.
              </p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="priorities">
              Key priorities (one per line)
            </label>
            <textarea
              id="priorities"
              name="priorities"
              defaultValue={client.priorities.join("\n")}
              rows={4}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="expectations">
              What the client can expect from us
            </label>
            <textarea
              id="expectations"
              name="expectations"
              defaultValue={client.expectations}
              rows={4}
              className="input"
            />
          </div>
          <SubmitButton>Save changes</SubmitButton>
        </form>
      </div>
      {me.role === "admin" && (
        <details className="card max-w-5xl border-red-200">
          <summary className="cursor-pointer text-sm font-semibold text-red-700">
            Admin only: delete this client
          </summary>
          <form action={remove} className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">
              This permanently deletes the portal, all its content and
              documents, and removes the client logins. Type the client name
              exactly to confirm: <b>{client.name}</b>
            </p>
            <input
              name="confirm"
              className="input max-w-sm"
              autoComplete="off"
            />
            <button className="btn-danger">Delete client permanently</button>
          </form>
        </details>
      )}
    </div>
  );
}
