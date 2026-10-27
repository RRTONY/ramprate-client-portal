import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { QueryRow } from "@/lib/types";
import { Empty, Pill } from "@/components/ui";

export default async function AdminQueries({
  params,
}: {
  params: { clientId: string };
}) {
  const { data } = await createClient()
    .from("queries")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });
  const queries = (data ?? []) as QueryRow[];
  if (queries.length === 0)
    return <Empty>No questions from this client yet.</Empty>;
  return (
    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {queries.map((q) => (
        <Link
          key={q.id}
          href={`/admin/clients/${params.clientId}/queries/${q.id}`}
          className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
        >
          <div>
            <div className="font-semibold">{q.subject}</div>
            <div className="text-xs text-slate-500">
              {q.category} · {fmtDate(q.created_at)}
            </div>
          </div>
          <Pill
            tone={
              q.status === "open"
                ? "amber"
                : q.status === "answered"
                  ? "green"
                  : "gray"
            }
          >
            {q.status}
          </Pill>
        </Link>
      ))}
    </div>
  );
}
