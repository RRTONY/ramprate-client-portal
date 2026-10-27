import { createClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/data";
import {
  fmtDateTime,
  fmtRelative,
  fmtShortDay,
  PROGRESS_LABEL,
} from "@/lib/format";
import {
  PROGRESS_STATUSES,
  type Meeting,
  type ProgressItem,
  type ProgressStatus,
} from "@/lib/types";
import { Empty, PageTitle } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ProgressRing } from "@/components/ProgressRing";
import { PhaseTimeline } from "@/components/PhaseTimeline";
import { PrintButton } from "@/components/PrintButton";

// Colour means something: green = done, purple = we are working on it, amber = waiting on you, grey = later.
const STYLE: Record<
  ProgressStatus,
  { bar: string; chip: string; icon: string }
> = {
  completed: {
    bar: "border-l-emerald-500",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: "text-emerald-600",
  },
  in_progress: {
    bar: "border-l-brand-500",
    chip: "bg-brand-50 text-brand-700 ring-brand-100",
    icon: "text-brand-500",
  },
  next_step: {
    bar: "border-l-violet",
    chip: "bg-brand-50 text-brand-700 ring-brand-100",
    icon: "text-violet",
  },
  pending: {
    bar: "border-l-amber-500",
    chip: "bg-amber-50 text-amber-800 ring-amber-200",
    icon: "text-amber-600",
  },
  upcoming: {
    bar: "border-l-slate-300",
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: "text-slate-500",
  },
};

function MeetingLink({ loc }: { loc: string }) {
  if (/^https?:\/\//.test(loc))
    return (
      <a
        href={loc}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon.video size={16} /> Join link
      </a>
    );
  return <div className="mt-1 text-sm">{loc}</div>;
}

export default async function Progress({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientOr404(params.clientId);
  const supabase = createClient();
  const [{ data: items }, { data: upcoming }, { data: past }] =
    await Promise.all([
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
        .order("starts_at"),
      supabase
        .from("meetings")
        .select("*")
        .eq("client_id", client.id)
        .lt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: false })
        .limit(5),
    ]);
  const progress = (items ?? []) as ProgressItem[];
  const total = progress.length;
  const done = progress.filter((p) => p.status === "completed").length;

  return (
    <>
      <PageTitle
        title="Progress and next steps"
        subtitle="Where things stand, what is coming up, and anything we are waiting on."
        action={<PrintButton />}
      />

      <section className="card mb-8" aria-label="Overall progress">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-4">
            <ProgressRing done={done} total={total} size={84} />
            <div>
              <div className="text-lg font-bold">
                {done} of {total} done
              </div>
              <div className="text-sm text-slate-600">
                {
                  progress.filter(
                    (p) =>
                      p.status === "in_progress" || p.status === "next_step",
                  ).length
                }{" "}
                underway
              </div>
            </div>
          </div>
          <PhaseTimeline
            phases={client.phases ?? []}
            current={client.current_phase ?? 0}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {total === 0 && (
            <Empty icon="progress" title="Nothing to show yet">
              Progress items will appear here as work gets underway, with a
              clear status on each one.
            </Empty>
          )}
          {PROGRESS_STATUSES.filter((s) =>
            progress.some((p) => p.status === s),
          ).map((s) => (
            <section key={s}>
              <h2 className="h-section">{PROGRESS_LABEL[s]}</h2>
              <div className="space-y-2.5">
                {progress
                  .filter((p) => p.status === s)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`card !p-4 border-l-4 ${STYLE[s].bar}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-0.5 ${STYLE[s].icon}`}>
                            {s === "completed" ? (
                              <Icon.check size={18} />
                            ) : s === "pending" ? (
                              <Icon.alert size={18} />
                            ) : s === "upcoming" ? (
                              <Icon.calendar size={18} />
                            ) : (
                              <Icon.flag size={18} />
                            )}
                          </span>
                          <div className="font-semibold leading-snug">
                            {p.title}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${STYLE[s].chip}`}
                        >
                          {PROGRESS_LABEL[s]}
                        </span>
                      </div>
                      {p.detail && (
                        <p className="mt-1.5 whitespace-pre-line pl-7 text-sm leading-relaxed text-slate-700">
                          {p.detail}
                        </p>
                      )}
                      <div className="mt-2 pl-7 text-xs text-slate-600">
                        {p.owner_name ? `Owner: ${p.owner_name}` : ""}
                        {p.owner_name && p.due_date ? " · " : ""}
                        {p.due_date
                          ? `${s === "completed" ? "Completed" : "Due"} ${fmtShortDay(p.due_date)}${s !== "completed" && fmtRelative(p.due_date) ? ` (${fmtRelative(p.due_date)})` : ""}`
                          : ""}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="space-y-8">
          <section>
            <h2 className="h-section">Upcoming meetings</h2>
            {((upcoming ?? []) as Meeting[]).length === 0 ? (
              <Empty icon="calendar" title="No meetings scheduled">
                Your next meeting will show here with its agenda and join link.
              </Empty>
            ) : (
              <div className="space-y-2.5">
                {((upcoming ?? []) as Meeting[]).map((m) => (
                  <div key={m.id} className="card !p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-snug">
                        {m.title}
                      </div>
                      {fmtRelative(m.starts_at) && (
                        <span className="whitespace-nowrap rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          {fmtRelative(m.starts_at)}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-sm text-slate-600">
                      {fmtDateTime(m.starts_at)}
                    </div>
                    {m.location && <MeetingLink loc={m.location} />}
                    {m.agenda && (
                      <div className="mt-3 text-sm">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          Agenda
                        </div>
                        <p className="whitespace-pre-line leading-relaxed text-slate-700">
                          {m.agenda}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {((past ?? []) as Meeting[]).length > 0 && (
            <section>
              <h2 className="h-section">Recent meetings</h2>
              <div className="space-y-2.5">
                {((past ?? []) as Meeting[]).map((m) => (
                  <div key={m.id} className="card !p-4">
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-xs text-slate-600">
                      {fmtDateTime(m.starts_at)}
                    </div>
                    {m.notes && (
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                        {m.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
