import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AuditTable } from "@/components/AuditTable";
import { PageTitle } from "@/components/ui";

const FILTERS = [
  { label: "Everything", value: "" },
  { label: "Sign-ins", value: "auth" },
  { label: "Documents", value: "document" },
  { label: "Client changes", value: "client" },
  { label: "Emails", value: "email" },
  { label: "Access changes", value: "staff" },
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  await requireAdmin();
  return (
    <>
      <PageTitle
        title="Audit log"
        subtitle="A permanent record of who signed in, viewed, downloaded or changed anything. Entries cannot be edited or deleted by anyone, including admins."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/audit?f=${f.value}` : "/admin/audit"}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${(searchParams.f ?? "") === f.value ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-300 bg-white text-slate-600"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <AuditTable action={searchParams.f} />
    </>
  );
}
