"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";

type Item = {
  href: string;
  label: string;
  icon?: IconName;
  latest?: string | null;
};

/**
 * Tab bar. With `seenKey` set, a purple dot appears on a tab when it has content newer than
 * the last time this browser opened it. "Last opened" is stored in this browser only.
 */
export function Tabs({
  base,
  items,
  seenKey,
}: {
  base: string;
  items: Item[];
  seenKey?: string;
}) {
  const pathname = usePathname();
  const [seen, setSeen] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!seenKey) return;
    const next: Record<string, number> = {};
    for (const it of items) {
      try {
        let v = Number(localStorage.getItem(`seen:${seenKey}:${it.href}`) || 0);
        if (!v) {
          // First ever visit in this browser: everything that exists now counts as seen.
          v = Date.now();
          localStorage.setItem(`seen:${seenKey}:${it.href}`, String(v));
        }
        next[it.href] = v;
      } catch {
        next[it.href] = Date.now();
      }
    }
    setSeen(next);
    setReady(true);
    // Mark the tab we are on as seen now.
    const here = items.find((it) =>
      it.href === "" ? pathname === base : pathname.startsWith(base + it.href),
    );
    if (here) {
      try {
        localStorage.setItem(
          `seen:${seenKey}:${here.href}`,
          String(Date.now()),
        );
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, seenKey]);

  return (
    <nav
      className="-mb-px flex gap-1 overflow-x-auto pb-px [scrollbar-width:none]"
      aria-label="Sections"
    >
      {items.map((it) => {
        const href = `${base}${it.href}`;
        const active =
          it.href === "" ? pathname === base : pathname.startsWith(href);
        const Ico = it.icon ? Icon[it.icon] : null;
        const isNew =
          ready &&
          !active &&
          !!seenKey &&
          !!it.latest &&
          new Date(it.latest).getTime() > (seen[it.href] || 0);
        return (
          <Link
            key={it.href}
            href={href}
            data-tour={it.href === "" ? "overview" : it.href.slice(1)}
            aria-current={active ? "page" : undefined}
            className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition ${
              active
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-slate-600 hover:text-ink"
            }`}
          >
            {Ico && <Ico size={17} />}
            {it.label}
            {isNew && (
              <span
                className="h-2 w-2 rounded-full bg-brand-500"
                aria-label="has new content"
                title="New since your last visit"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
