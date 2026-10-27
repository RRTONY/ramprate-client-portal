import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { Empty, Pill } from "@/components/ui";

type Row = {
  id: number;
  at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  client_id: string | null;
  detail: Record<string, unknown>;
  clients?: { name: string } | null;
};

const TONE: Record<string, "purple" | "gray" | "green" | "amber"> = {
  admin: "purple",
  staff: "gray",
  client: "green",
};

function summarize(d: Record<string, unknown>): string {
  const parts = Object.entries(d)
    .filter(([, v]) => v !== null && v !== "" && typeof v !== "object")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join(" · ");
}

/** Read-only view of the append-only audit log. RLS decides which rows the viewer may see. */
export async function AuditTable({
  clientId,
  limit = 200,
  action,
}: {
  clientId?: string;
  limit?: number;
  action?: string;
}) {
  const supabase = createClient();
  let q = supabase
    .from("audit_log")
    .select("*, clients(name)")
    .order("at", { ascending: false })
    .limit(limit);
  if (clientId) q = q.eq("client_id", clientId);
  if (action) q = q.like("action", `${action}%`);
  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return <Empty>No activity recorded yet.</Empty>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">When (Pacific)</th>
            <th className="px-4 py-3">Who</th>
            <th className="px-4 py-3">Action</th>
            {!clientId && <th className="px-4 py-3">Client</th>}
            <th className="px-4 py-3">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                {fmtDateTime(r.at)}
              </td>
              <td className="px-4 py-2.5">
                <div className="font-medium">{r.actor_email ?? "System"}</div>
                {r.actor_role && (
                  <Pill tone={TONE[r.actor_role] ?? "gray"}>
                    {r.actor_role}
                  </Pill>
                )}
              </td>
              <td className="px-4 py-2.5 font-mono text-xs">{r.action}</td>
              {!clientId && (
                <td className="px-4 py-2.5">{r.clients?.name ?? ""}</td>
              )}
              <td className="px-4 py-2.5 text-xs text-slate-600">
                {summarize(r.detail)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
