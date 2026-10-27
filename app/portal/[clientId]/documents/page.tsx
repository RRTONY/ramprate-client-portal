import { createClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/data";
import { fmtDate, fmtSize } from "@/lib/format";
import { DOC_CATEGORIES, type DocumentRow } from "@/lib/types";
import { Empty, PageTitle, Pill } from "@/components/ui";
import { FileTypeIcon, Icon } from "@/components/icons";

const NEW_DAYS = 7;

export default async function Documents({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientOr404(params.clientId);
  const supabase = createClient();
  const { data } = await supabase
    .from("documents")
    .select("*")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as DocumentRow[];
  const cutoff = Date.now() - NEW_DAYS * 86400_000;

  return (
    <>
      <PageTitle
        title="Documents and paperwork"
        subtitle="Your NDAs, agreements, statements of work and onboarding documents, always available to view and download."
      />
      {docs.length === 0 ? (
        <Empty icon="documents" title="No documents yet">
          Your NDA, agreements and onboarding documents will appear here as soon
          as they are ready. We will email you when something new is added.
        </Empty>
      ) : (
        <div className="space-y-8">
          {DOC_CATEGORIES.filter((c) => docs.some((d) => d.category === c)).map(
            (cat) => (
              <section key={cat}>
                <h2 className="h-section">{cat}</h2>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
                  {docs
                    .filter((d) => d.category === cat)
                    .map((d) => {
                      const isNew = new Date(d.created_at).getTime() > cutoff;
                      return (
                        <li
                          key={d.id}
                          className="flex flex-wrap items-center justify-between gap-3 p-4"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileTypeIcon fileName={d.file_name} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold leading-snug">
                                  {d.title}
                                </span>
                                {d.is_signed && (
                                  <Pill tone="green">
                                    <span className="inline-flex items-center gap-1">
                                      <Icon.check size={12} /> Signed
                                    </span>
                                  </Pill>
                                )}
                                {isNew && <Pill tone="purple">New</Pill>}
                              </div>
                              <div className="truncate text-xs text-slate-600">
                                {d.file_name} · {fmtSize(d.file_size)} · added{" "}
                                {fmtDate(d.created_at)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/portal/${client.id}/documents/${d.id}/download?mode=view`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary !py-1.5"
                              aria-label={`View ${d.title}`}
                            >
                              <Icon.eye size={16} /> View
                            </a>
                            <a
                              href={`/portal/${client.id}/documents/${d.id}/download`}
                              className="btn !py-1.5"
                              aria-label={`Download ${d.title}`}
                            >
                              <Icon.download size={16} /> Download
                            </a>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ),
          )}
        </div>
      )}
    </>
  );
}
