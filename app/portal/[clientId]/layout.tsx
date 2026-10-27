import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getClientOr404 } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { Tabs } from "@/components/PortalShell";
import { HealthBadge } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { SocialLinks } from "@/components/SocialLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import { Tour, TourButton } from "@/components/Tour";
import { PageNext } from "@/components/PageNext";
import { fmtDate, fmtRelative } from "@/lib/format";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const profile = await requireProfile();
  const client = await getClientOr404(params.clientId);
  const base = `/portal/${client.id}`;
  const supabase = createClient();

  // Newest content per tab, used for the "new since your last visit" dots.
  const newest = async (
    table: string,
    col: string,
    extra?: (q: any) => any,
  ) => {
    let q: any = supabase
      .from(table)
      .select(col)
      .eq("client_id", client.id)
      .order(col, { ascending: false })
      .limit(1);
    if (extra) q = extra(q);
    const { data } = await q;
    return (data?.[0]?.[col] as string | undefined) ?? null;
  };
  const [lastUpdate, lastDoc, lastProgress, lastMeeting, lastMsg] =
    await Promise.all([
      newest("updates", "created_at"),
      newest("documents", "created_at"),
      newest("progress_items", "updated_at"),
      newest("meetings", "created_at"),
      newest("query_messages", "created_at", (q) =>
        q.neq("author_id", profile.id),
      ),
    ]);
  const progressLatest =
    [lastProgress, lastMeeting].filter(Boolean).sort().pop() ?? null;

  const TABS = [
    { href: "", label: "Overview", icon: "home" as const, latest: null },
    {
      href: "/progress",
      label: "Progress & next steps",
      icon: "progress" as const,
      latest: progressLatest,
    },
    {
      href: "/updates",
      label: "Activity",
      icon: "activity" as const,
      latest: lastUpdate,
    },
    {
      href: "/documents",
      label: "Documents",
      icon: "documents" as const,
      latest: lastDoc,
    },
    {
      href: "/queries",
      label: "Questions",
      icon: "chat" as const,
      latest: lastMsg,
    },
    { href: "/team", label: "Your team", icon: "team" as const, latest: null },
  ];

  const rel = fmtRelative(client.last_updated_at);
  return (
    <div className="min-h-screen">
      {profile.role !== "client" && (
        <div className="no-print bg-ink px-4 py-2 text-center text-xs text-white">
          Staff preview of the client view.{" "}
          <Link
            href={`/admin/clients/${client.id}`}
            className="font-semibold underline"
          >
            Back to editing
          </Link>
        </div>
      )}
      <header className="no-print border-b border-slate-200 bg-white">
        <div
          className="h-1 bg-gradient-to-r from-brand-700 via-brand-500 to-violet"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between gap-3 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Logo size={34} />
              <div className="hidden h-9 w-px bg-slate-200 sm:block" />
              <div className="min-w-0">
                <div className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-600 sm:block">
                  Client portal
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-base font-bold sm:text-lg">
                    {client.name}
                  </span>
                  <HealthBadge health={client.health} />
                </div>
              </div>
            </div>
            <div className="flex flex-none items-center gap-2 text-sm sm:gap-3">
              <ThemeToggle />
              <Link
                href={`${base}/account`}
                className="flex items-center gap-2 font-semibold text-slate-600 hover:text-brand-700"
                aria-label="Your account"
              >
                <Avatar name={profile.full_name || profile.email} size={30} />
                <span className="hidden md:inline">
                  {profile.full_name || "Account"}
                </span>
              </Link>
              <form action="/auth/signout" method="post">
                <button className="btn-secondary !px-3 !py-1.5">
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <Tabs
            base={base}
            items={TABS}
            seenKey={`${profile.id}:${client.id}`}
          />
        </div>
      </header>
      <div className="no-print border-b border-slate-200 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 text-xs text-slate-600">
          <span>
            Last updated{" "}
            <b className="text-ink">{fmtDate(client.last_updated_at)}</b>
            {rel && <span> ({rel})</span>}
          </span>
          {client.next_update_due && (
            <span>
              Next update due{" "}
              <b className="text-ink">{fmtDate(client.next_update_due)}</b>
              {fmtRelative(client.next_update_due) && (
                <span> ({fmtRelative(client.next_update_due)})</span>
              )}
            </span>
          )}
          <span className="no-print ml-auto">
            <TourButton />
          </span>
        </div>
      </div>
      <Tour auto={profile.role === "client"} />
      <main id="main" className="fade-in mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {children}
        <PageNext base={base} />
      </main>
      <footer className="no-print mx-auto mt-4 max-w-6xl border-t border-slate-200 px-4 py-6 text-xs text-slate-600">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p>
              All times shown in Pacific Time. Questions? Use the Questions tab
              and we will respond directly.
            </p>
            <p className="mt-1">
              <Link href="/privacy" className="underline">
                Privacy and security
              </Link>{" "}
              · Client portal by RampRate
            </p>
          </div>
          <SocialLinks />
        </div>
      </footer>
    </div>
  );
}
