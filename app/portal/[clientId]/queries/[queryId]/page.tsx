import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { QueryThread } from "@/components/QueryThread";

export default async function QueryPage({
  params,
  searchParams,
}: {
  params: { clientId: string; queryId: string };
  searchParams: { sent?: string };
}) {
  const profile = await requireProfile();
  return (
    <>
      <Link
        href={`/portal/${params.clientId}/queries`}
        className="mb-4 inline-block text-sm font-semibold text-brand-700"
      >
        Back to questions
      </Link>
      <QueryThread
        clientId={params.clientId}
        queryId={params.queryId}
        staff={profile.role !== "client"}
        sent={searchParams.sent}
      />
    </>
  );
}
