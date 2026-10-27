import { AuditTable } from "@/components/AuditTable";

export default function ClientHistory({
  params,
}: {
  params: { clientId: string };
}) {
  return <AuditTable clientId={params.clientId} />;
}
