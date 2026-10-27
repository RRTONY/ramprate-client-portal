import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/data";
import { createQuery } from "@/lib/query-actions";
import { fmtDate } from "@/lib/format";
import { QUERY_CATEGORIES, type QueryRow } from "@/lib/types";
import { Empty, Notice, PageTitle, Pill } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export default async function Queries({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { error?: string };
}) {
  const client = await getClientOr404(params.clientId);
  const supabase = createClient();
  const { data } = await supabase
    .from("queries")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const queries = (data ?? []) as QueryRow[];
  const submit = createQuery.bind(null, client.id);

  return (
    <>
      <PageTitle
        title="Questions and communication"
        subtitle="Ask anything about your engagement. It goes straight to your engagement owner and our admin team, and the answer is kept here for reference."
      />
      {searchParams.error && (
        <Notice kind="error">
          Please add a subject and a message, then try again.
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <form action={submit} className="card space-y-4 lg:col-span-2">
          <h2 className="h-section !mb-0">Ask a new question</h2>
          <div>
            <label className="label" htmlFor="category">
              Topic
            </label>
            <select id="category" name="category" className="input">
              {QUERY_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="subject">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              required
              maxLength={160}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="body">
              Your question
            </label>
            <textarea
              id="body"
              name="body"
              required
              rows={6}
              className="input"
            />
          </div>
          <SubmitButton pendingText="Sending...">Send question</SubmitButton>
        </form>

        <section className="lg:col-span-3">
          <h2 className="h-section">Your conversations</h2>
          {queries.length === 0 ? (
            <Empty icon="mail" title="No questions yet">
              Anything you ask appears here with the replies. It goes straight
              to your engagement owner, and we will email you when we answer.
            </Empty>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {queries.map((q) => (
                <Link
                  key={q.id}
                  href={`/portal/${client.id}/queries/${q.id}`}
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
          )}
        </section>
      </div>
    </>
  );
}
