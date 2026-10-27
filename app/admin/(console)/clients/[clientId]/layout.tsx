import Link from "next/link";
import { getClientOr404 } from "@/lib/data";
import { Tabs } from "@/components/PortalShell";
import { HealthBadge } from "@/components/ui";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/progress", label: "Progress" },
  { href: "/updates", label: "Activity" },
  { href: "/meetings", label: "Meetings" },
  { href: "/documents", label: "Documents" },
  { href: "/team", label: "Team" },
  { href: "/queries", label: "Questions" },
  { href: "/access", label: "Access" },
  { href: "/history", label: "History" },
];

export default async function ClientAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const client = await getClientOr404(params.clientId);
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <HealthBadge health={client.health} />
        </div>
        <Link href={`/portal/${client.id}`} className="btn-secondary">
          Preview client view
        </Link>
      </div>
      <div className="mb-6 border-b border-slate-200">
        <Tabs base={`/admin/clients/${client.id}`} items={TABS} />
      </div>
      {children}
    </>
  );
}
