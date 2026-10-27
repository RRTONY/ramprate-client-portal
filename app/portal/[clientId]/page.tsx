import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getClientOr404, getClientTeam } from "@/lib/data";
import {
  fmtDate,
  fmtDateTime,
  fmtRelative,
  fmtShortDay,
  KIND_LABEL,
} from "@/lib/format";
import { Pill } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/icons";
import { ProgressRing } from "@/components/ProgressRing";
import { ExpandableText } from "@/components/ExpandableText";
import { HeroOrbs } from "@/components/HeroOrbs";
import type { Meeting, ProgressItem, UpdateRow } from "@/lib/types";

export default async function Overview({
  params,
}: {
  params: { clientId: string };
}) {
  const profile = await requireProfile();
  const client = await getClientOr404(params.clientId);
  const supabase = createClient();
  const [team, { data: allProgress }, { data: meetings }, { data: updates }] =
    await Promise.all([
      getClientTeam(client.id),
      supabase
        .from("progress_items")
        .select("*")
        .eq("client_id", client.id)
        .order("due_date", { nullsFirst: false }),
      supabase
        .from("meetings")
        .select("*")
        .eq("client_id", client.id)
        .gte("starts_at", new Date().toISOString())
        .order("starts_at")
        .limit(1),
      supabase
        .from("updates")
        .select("*")
        .eq("client_id", client.id)
        .order("occurred_on", { ascending: false })
        .limit(3),
    ]);
  const progress = (allProgress ?? []) as ProgressItem[];
  const done = progress.filter((p) => p.status === "completed").length;
  const actions = progress.filter((p) => p.status === "pending");
  const now = progress
    .filter((p) => p.status === "next_step" || p.status === "in_progress")
    .slice(0, 5);
  const spoc =
    team.find((t) => t.team_member_id === client.spoc_id)?.team_members ?? null;
  const owner =
    team.find((t) => t.team_member_id === client.engagement_owner_id)
      ?.team_members ?? null;
  const nextMeeting = ((meetings ?? []) as Meeting[])[0];
  const base = `/portal/${client.id}`;
  const { data: newDocs } = await supabase
    .from("documents")
    .select("id")
    .eq("client_id", client.id)
    .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
    .limit(5);
  const guide =
    actions.length > 0
      ? {
          href: `${base}/progress`,
          title: `${actions.length === 1 ? "1 item is" : `${actions.length} items are`} waiting on you`,
          text: `Start with "${actions[0].title}". It keeps everything on schedule.`,
          cta: "Open it",
        }
      : (newDocs ?? []).length > 0
        ? {
            href: `${base}/documents`,
            title: `${(newDocs ?? []).length === 1 ? "A new document is" : "New documents are"} ready`,
            text: "Have a look and download a copy for your records.",
            cta: "View documents",
          }
        : nextMeeting
          ? {
              href: `${base}/progress`,
              title: `Your next meeting is ${fmtRelative(nextMeeting.starts_at) || "coming up"}`,
              text: "See the agenda and join link so you can prepare.",
              cta: "See agenda",
            }
          : {
              href: `${base}/updates`,
              title: "You are all caught up",
              text: "Nothing needs you right now. See the latest activity or ask us a question.",
              cta: "See activity",
            };
  const first = (profile.full_name || "").split(" ")[0];

  return (
    <div className="space-y-8">
      {/* ===== Hero summary strip ===== */}
      <section className="fade-in overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white shadow-md">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="text-sm font-medium text-white/80">
              {first ? `Welcome back, ${first}` : "Welcome back"}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {client.name}
            </h1>
            <p className="mt-1 text-[15px] text-white/90">{client.status}</p>
            {client.welcome_note && owner && (
              <div className="mt-5 flex gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <Avatar name={owner.full_name} size={40} />
                <div>
                  <p className="text-sm leading-relaxed text-white/95">
                    &ldquo;{client.welcome_note}&rdquo;
                  </p>
                  <p className="mt-1 text-xs font-semibold text-white/80">
                    {owner.full_name}, {owner.title}
                  </p>
                </div>
              </div>
            )}
            {spoc && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Avatar name={spoc.full_name} size={44} ring />
                <div className="mr-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
                    Your point of contact
                  </div>
                  <div className="font-semibold">{spoc.full_name}</div>
                </div>
                <a
                  href={`mailto:${spoc.email}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
                >
                  <Icon.mail size={16} /> Email
                </a>
                {spoc.calendly_url && (
                  <a
                    href={spoc.calendly_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 keep-light rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    <Icon.calendar size={16} /> Book a meeting
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-center lg:col-span-2">
            <HeroOrbs
              base={`/portal/${client.id}`}
              done={done}
              total={progress.length}
              meetingDay={
                nextMeeting ? fmtShortDay(nextMeeting.starts_at) : null
              }
              meetingRel={
                nextMeeting
                  ? fmtRelative(nextMeeting.starts_at) || "Next meeting"
                  : null
              }
              waiting={actions.length}
            />
          </div>
        </div>
      </section>

      {/* ===== Guided next step ===== */}
      <Link
        href={guide.href}
        className="next-card fade-in-2 group flex items-center gap-4 rounded-2xl border-2 border-brand-500 bg-brand-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
      >
        <span className="relative flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-500 text-white">
          <span
            className="orb-attn absolute inset-0 rounded-full"
            aria-hidden="true"
          />
          <Icon.compass size={24} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wide text-brand-700">
            Your next step
          </span>
          <span className="block text-lg font-bold leading-snug">
            {guide.title}
          </span>
          <span className="block text-sm text-slate-700">{guide.text}</span>
        </span>
        <span className="hidden items-center gap-1 text-sm font-bold text-brand-700 sm:inline-flex">
          {guide.cta} <Icon.arrow size={18} className="arrow-nudge" />
        </span>
        <Icon.arrow
          size={22}
          className="arrow-nudge flex-none text-brand-700 sm:hidden"
        />
      </Link>

      {/* ===== Action needed ===== */}
      {actions.length > 0 && (
        <section
          className="fade-in-2 rounded-xl border border-amber-300 bg-amber-50 p-5"
          aria-labelledby="action-h"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white">
              <Icon.alert size={16} />
            </span>
            <h2 id="action-h" className="font-bold text-amber-900">
              Action needed from you ({actions.length})
            </h2>
          </div>
          <ul className="space-y-2">
            {actions.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
              >
                <div>
                  <div className="font-semibold">{a.title}</div>
                  {a.detail && (
                    <div className="text-sm text-slate-700">{a.detail}</div>
                  )}
                </div>
                {a.due_date && (
                  <span className="whitespace-nowrap text-sm font-semibold text-amber-800">
                    Needed by {fmtShortDay(a.due_date)}
                    {fmtRelative(a.due_date)
                      ? ` (${fmtRelative(a.due_date)})`
                      : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            Stuck or unsure? Use the Questions tab and we will help right away.
          </p>
        </section>
      )}

      <div className="fade-in-3 grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">What we are working on for you</h2>
            <ExpandableText
              text={
                client.summary || "Your engagement summary will appear here."
              }
              lines={4}
              className="prose-narrow"
            />
          </section>
          <section className="card">
            <h2 className="h-section">Our approach</h2>
            <ExpandableText
              text={client.approach || "Our approach will be shared here."}
              lines={4}
              className="prose-narrow"
            />
          </section>
          <section className="card">
            <h2 className="h-section">Key priorities</h2>
            {client.priorities.length === 0 ? (
              <p className="text-sm text-slate-600">
                No priorities listed yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {client.priorities.map((p, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-snug">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{p}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="card">
            <h2 className="h-section">What you can expect from us</h2>
            <p className="prose-narrow whitespace-pre-line">
              {client.expectations ||
                "Our commitments to you will appear here."}
            </p>
          </section>
        </div>

        <aside className="space-y-8">
          <section className="card">
            <h2 className="h-section">Happening now and next</h2>
            {now.length === 0 ? (
              <p className="text-sm text-slate-600">Nothing queued yet.</p>
            ) : (
              <ul className="space-y-4">
                {now.map((n) => (
                  <li key={n.id} className="flex gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${n.status === "next_step" ? "bg-violet" : "bg-brand-500"}`}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="text-sm font-semibold leading-snug">
                        {n.title}
                      </div>
                      <div className="text-xs text-slate-600">
                        {n.status === "next_step" ? "Next step" : "In progress"}
                        {n.due_date
                          ? ` · due ${fmtShortDay(n.due_date)}${fmtRelative(n.due_date) ? ` (${fmtRelative(n.due_date)})` : ""}`
                          : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/portal/${client.id}/progress`}
              className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
            >
              See full progress
            </Link>
          </section>

          <section className="card">
            <h2 className="h-section">Next meeting</h2>
            {nextMeeting ? (
              <div>
                <div className="font-semibold">{nextMeeting.title}</div>
                <div className="text-sm text-slate-600">
                  {fmtDateTime(nextMeeting.starts_at)}
                </div>
                {fmtRelative(nextMeeting.starts_at) && (
                  <div className="mt-1 text-xs font-semibold text-brand-700">
                    {fmtRelative(nextMeeting.starts_at)}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                No upcoming meetings scheduled.
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="h-section">Latest activity</h2>
            {((updates ?? []) as UpdateRow[]).length === 0 ? (
              <p className="text-sm text-slate-600">No updates yet.</p>
            ) : (
              <ul className="space-y-4">
                {((updates ?? []) as UpdateRow[]).map((u) => (
                  <li key={u.id}>
                    <div className="mb-0.5 flex items-center gap-2">
                      <Pill
                        tone={
                          u.kind === "milestone"
                            ? "purple"
                            : u.kind === "completed"
                              ? "green"
                              : u.kind === "change"
                                ? "amber"
                                : "gray"
                        }
                      >
                        {KIND_LABEL[u.kind]}
                      </Pill>
                      <span className="text-xs text-slate-600">
                        {fmtDate(u.occurred_on)}
                      </span>
                    </div>
                    <div className="text-sm font-semibold leading-snug">
                      {u.title}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href={`/portal/${client.id}/updates`}
              className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
            >
              View all activity
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
