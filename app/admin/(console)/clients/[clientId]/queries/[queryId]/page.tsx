import Link from "next/link";
import { QueryThread } from "@/components/QueryThread";

export default function AdminQuery({
  params,
}: {
  params: { clientId: string; queryId: string };
}) {
  return (
    <>
      <Link
        href={`/admin/clients/${params.clientId}/queries`}
        className="mb-4 inline-block text-sm font-semibold text-brand-700"
      >
        Back to questions
      </Link>
      <QueryThread clientId={params.clientId} queryId={params.queryId} staff />
    </>
  );
}
