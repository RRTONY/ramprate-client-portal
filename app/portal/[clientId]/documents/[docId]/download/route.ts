import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/audit";

// Creates a short-lived signed URL. The documents row is read under RLS, so a user can only
// reach files for their own client, and clients never reach unpublished documents.
export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string; docId: string } },
) {
  const supabase = createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, file_name, title")
    .eq("id", params.docId)
    .eq("client_id", params.clientId)
    .maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const view = request.nextUrl.searchParams.get("mode") === "view";
  await logEvent({
    action: view ? "document.view" : "document.download",
    entity: "document",
    entityId: params.docId,
    clientId: params.clientId,
    detail: { title: doc.title, file: doc.file_name },
  });
  const { data, error } = await supabase.storage
    .from("client-documents")
    .createSignedUrl(
      doc.storage_path,
      60,
      view ? undefined : { download: doc.file_name },
    );
  if (error || !data)
    return new NextResponse("Could not open this document", { status: 500 });
  return NextResponse.redirect(data.signedUrl);
}
