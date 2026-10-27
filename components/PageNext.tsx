"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

const STEPS: { href: string; title: string; text: string; icon: IconName }[] = [
  {
    href: "",
    title: "Overview",
    text: "Your summary and anything that needs you.",
    icon: "home",
  },
  {
    href: "/progress",
    title: "Progress and next steps",
    text: "See what is done, underway and coming up.",
    icon: "progress",
  },
  {
    href: "/updates",
    title: "Activity",
    text: "Read the latest updates and milestones.",
    icon: "activity",
  },
  {
    href: "/documents",
    title: "Documents",
    text: "View or download your agreements and reports.",
    icon: "documents",
  },
  {
    href: "/queries",
    title: "Questions",
    text: "Ask us anything. It goes straight to your team.",
    icon: "chat",
  },
  {
    href: "/team",
    title: "Your team",
    text: "Meet your team and book a call.",
    icon: "team",
  },
];

/** "Where to next" card at the bottom of each main page, following the tab order. */
export function PageNext({ base }: { base: string }) {
  const path = usePathname();
  const idx = STEPS.findIndex((s) => path === base + s.href);
  if (idx < 0) return null;
  const next = STEPS[(idx + 1) % STEPS.length];
  const last = idx === STEPS.length - 1;
  const Ico = Icon[next.icon];
  return (
    <nav className="no-print mt-12" aria-label="Where to next">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
        {last
          ? "That is everything. Back to the start?"
          : `Step ${idx + 1} of ${STEPS.length}  ·  Next up`}
      </div>
      <Link
        href={base + next.href}
        className="next-card group flex items-center gap-4 rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md sm:p-5"
      >
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-500 text-white transition group-hover:scale-110">
          <Ico size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{next.title}</span>
          <span className="block text-sm text-slate-600">{next.text}</span>
        </span>
        <Icon.arrow
          size={22}
          className="arrow-nudge flex-none text-brand-700"
        />
      </Link>
    </nav>
  );
}
