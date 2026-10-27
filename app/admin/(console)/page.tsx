import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { Empty, HealthBadge, PageTitle, Pill } from "@/components/ui";
import type { Client } from "@/lib/types";

export default async function AdminHome() {
  const profile = await requireStaff();
  const supabase = createClient();
  const [{ data: clients }, { data: openQ }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "*, owner:team_members!clients_engagement_owner_id_fkey(full_name)",
      )
      .order("name"),
    supabase.from("queries").select("client_id").eq("status", "open"),
  ]);
  const counts = new Map<string, number>();
  (openQ ?? []).forEach((q) =>
    counts.set(q.client_id, (counts.get(q.client_id) ?? 0) + 1),
  );
  const rows = (clients ?? []) as unknown as (Client & {
    owner: { full_name: string } | null;
  })[];

  return (
    <>
      <PageTitle
        title="Client portals"
        subtitle={
          profile.role === "admin"
            ? "All client engagements."
            : "The client engagements you manage."
        }
        action={
          profile.role === "admin" ? (
            <Link href="/admin/clients/new" className="btn">
              New client
            </Link>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <Empty>No clients yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="card transition hover:border-brand-500"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="font-bold">{c.name}</div>
                <HealthBadge health={c.health} />
              </div>
              <div className="text-sm text-slate-600">{c.status}</div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <span>Owner: {c.owner?.full_name ?? "Unassigned"}</span>
                {Date.now() - new Date(c.last_updated_at).getTime() >
                  10 * 86400_000 && (
                  <Pill tone="amber">Not updated in 10+ days</Pill>
                )}
                {(counts.get(c.id) ?? 0) > 0 && (
                  <Pill tone="amber">
                    {counts.get(c.id)} open question
                    {counts.get(c.id) === 1 ? "" : "s"}
                  </Pill>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
