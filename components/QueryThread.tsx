import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { replyToQuery, setQueryStatus } from "@/lib/query-actions";
import { Notice, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import type { QueryMessage, QueryRow } from "@/lib/types";

export async function QueryThread({
  clientId,
  queryId,
  staff,
  sent,
}: {
  clientId: string;
  queryId: string;
  staff: boolean;
  sent?: string;
}) {
  const supabase = createClient();
  const { data: q } = await supabase
    .from("queries")
    .select("*")
    .eq("id", queryId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!q) return <Notice kind="error">Query not found.</Notice>;
  const query = q as QueryRow;
  const { data: msgs } = await supabase
    .from("query_messages")
    .select("*, profiles(full_name, role)")
    .eq("query_id", queryId)
    .order("created_at");
  const messages = (msgs ?? []) as unknown as QueryMessage[];

  const reply = replyToQuery.bind(null, clientId, queryId);
  const close = setQueryStatus.bind(null, clientId, queryId, "closed");
  const reopen = setQueryStatus.bind(null, clientId, queryId, "open");

  return (
    <div className="mx-auto max-w-3xl">
      {sent === "1" && (
        <Notice kind="success">
          Your question was sent to your RampRate team. You will hear back here
          and by email.
        </Notice>
      )}
      {sent === "0" && (
        <Notice>
          Your question was saved and your team can see it in the portal. The
          email notification could not be sent, so we may be a little slower to
          notice it.
        </Notice>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{query.subject}</h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Pill
              tone={
                query.status === "open"
                  ? "amber"
                  : query.status === "answered"
                    ? "green"
                    : "gray"
              }
            >
              {query.status}
            </Pill>
            <span>{query.category}</span>
          </div>
        </div>
        <form action={query.status === "closed" ? reopen : close}>
          <button className="btn-secondary !py-1.5">
            {query.status === "closed" ? "Reopen" : "Mark as resolved"}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {messages.map((m) => {
          const fromStaff = m.profiles?.role !== "client";
          return (
            <div
              key={m.id}
              className={`flex gap-3 rounded-xl border p-4 ${fromStaff ? "border-brand-100 bg-brand-50" : "border-slate-200 bg-white"}`}
            >
              <Avatar
                name={m.profiles?.full_name || (fromStaff ? "RampRate" : "You")}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-600">
                  <span className="font-semibold text-ink">
                    {m.profiles?.full_name || (fromStaff ? "RampRate" : "You")}
                    {fromStaff ? " · RampRate" : ""}
                  </span>
                  <span>{fmtDateTime(m.created_at)}</span>
                </div>
                <p className="whitespace-pre-line text-sm leading-relaxed">
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {query.status !== "closed" && (
        <ActionForm action={reply} className="card mt-5 space-y-3" savedText="Reply sent">
          <label className="label" htmlFor="body">
            {staff ? "Reply to the client" : "Add a reply"}
          </label>
          <textarea id="body" name="body" required rows={4} className="input" />
          <SubmitButton pendingText="Sending...">Send reply</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
