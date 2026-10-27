import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export type ReadinessItem = {
  key: string;
  label: string;
  ok: boolean;
  hint: string;
};

/**
 * The "nothing blank" rule: a client's portal must be complete before the client is invited.
 * Admins can still override (see inviteClientUser), and the override is written to the audit log.
 */
export async function getReadiness(
  client: Client,
): Promise<{ items: ReadinessItem[]; ready: boolean; done: number }> {
  const supabase = createClient();
  const [docs, progress, meetings, team] = await Promise.all([
    supabase
      .from("documents")
      .select("id, category")
      .eq("client_id", client.id)
      .eq("published", true),
    supabase
      .from("progress_items")
      .select("id, status")
      .eq("client_id", client.id),
    supabase
      .from("meetings")
      .select("id")
      .eq("client_id", client.id)
      .gte("starts_at", new Date().toISOString()),
    supabase.from("client_team").select("id").eq("client_id", client.id),
  ]);
  const publishedDocs = docs.data ?? [];
  const nextSteps = (progress.data ?? []).filter(
    (p) => p.status !== "completed",
  );
  const items: ReadinessItem[] = [
    {
      key: "summary",
      label: "What we are working on is written",
      ok: client.summary.trim().length > 20,
      hint: "Overview tab",
    },
    {
      key: "approach",
      label: "Our approach is written",
      ok: client.approach.trim().length > 20,
      hint: "Overview tab",
    },
    {
      key: "priorities",
      label: "At least one key priority",
      ok: client.priorities.length > 0,
      hint: "Overview tab",
    },
    {
      key: "expect",
      label: "What the client can expect is written",
      ok: client.expectations.trim().length > 10,
      hint: "Overview tab",
    },
    {
      key: "owner",
      label: "Engagement owner assigned",
      ok: !!client.engagement_owner_id,
      hint: "Overview tab",
    },
    {
      key: "spoc",
      label: "Client SPOC assigned",
      ok: !!client.spoc_id,
      hint: "Overview tab",
    },
    {
      key: "team",
      label: "At least two people on the team page",
      ok: (team.data ?? []).length >= 2,
      hint: "Team tab",
    },
    {
      key: "docs",
      label: "Signed paperwork uploaded (NDA, MSA or SOW) and visible",
      ok: publishedDocs.some((d) => ["NDA", "MSA", "SOW"].includes(d.category)),
      hint: "Documents tab",
    },
    {
      key: "next",
      label: "At least one next step or open item",
      ok: nextSteps.length > 0,
      hint: "Progress tab",
    },
    {
      key: "meeting",
      label: "Next meeting scheduled",
      ok: (meetings.data ?? []).length > 0,
      hint: "Meetings tab",
    },
    {
      key: "due",
      label: "Next update due date set",
      ok: !!client.next_update_due,
      hint: "Overview tab",
    },
  ];
  const done = items.filter((i) => i.ok).length;
  return { items, ready: done === items.length, done };
}
