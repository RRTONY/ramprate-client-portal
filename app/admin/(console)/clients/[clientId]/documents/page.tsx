import { createClient } from "@/lib/supabase/server";
import {
  deleteDocument,
  toggleDocument,
  uploadDocument,
} from "@/lib/admin-actions";
import { fmtDate, fmtSize } from "@/lib/format";
import { DOC_CATEGORIES, type DocumentRow } from "@/lib/types";
import { Notice, Pill } from "@/components/ui";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";

const ERR: Record<string, string> = {
  nofile: "Choose a file to upload.",
  toolarge: "That file is over the 25 MB limit.",
  upload: "The upload failed. Please try again.",
  save: "The file uploaded but could not be saved. Please try again.",
};

export default async function AdminDocuments({
  params,
  searchParams,
}: {
  params: { clientId: string };
  searchParams: { error?: string; ok?: string };
}) {
  const { data } = await createClient()
    .from("documents")
    .select("*")
    .eq("client_id", params.clientId)
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as DocumentRow[];
  const upload = uploadDocument.bind(null, params.clientId);

  return (
    <div className="space-y-6">
      {searchParams.error && (
        <Notice kind="error">
          {ERR[searchParams.error] ?? "Something went wrong."}
        </Notice>
      )}
      {searchParams.ok && <Notice kind="success">Document uploaded.</Notice>}
      <DocumentUploadForm
        clientId={params.clientId}
        categories={DOC_CATEGORIES}
        action={upload}
      />

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {docs.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            No documents yet.
          </div>
        )}
        {docs.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{d.title}</span>
                <Pill tone="gray">{d.category}</Pill>
                {!d.published && <Pill tone="amber">Hidden from client</Pill>}
              </div>
              <div className="text-xs text-slate-500">
                {d.file_name} · {fmtSize(d.file_size)} · {fmtDate(d.created_at)}
              </div>
            </div>
            <div className="flex gap-2">
              <a
                href={`/portal/${params.clientId}/documents/${d.id}/download`}
                className="btn-secondary !py-1.5 !text-xs"
              >
                Download
              </a>
              <form
                action={toggleDocument.bind(
                  null,
                  params.clientId,
                  d.id,
                  !d.published,
                )}
              >
                <button className="btn-secondary !py-1.5 !text-xs">
                  {d.published ? "Hide" : "Publish"}
                </button>
              </form>
              <form action={deleteDocument.bind(null, params.clientId, d.id)}>
                <button className="btn-danger">Delete</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
