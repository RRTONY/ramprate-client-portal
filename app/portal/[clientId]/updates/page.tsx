import { createClient } from "@/lib/supabase/server";
import { getClientOr404 } from "@/lib/data";
import { fmtDate, fmtRelative, KIND_LABEL } from "@/lib/format";
import type { UpdateRow } from "@/lib/types";
import { Empty, PageTitle, Pill } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const DOT: Record<string, string> = {
  milestone: "bg-brand-500 text-white",
  completed: "bg-emerald-500 text-white",
  ongoing: "bg-sky-500 text-white",
  update: "bg-slate-400 text-white",
  change: "bg-amber-500 text-white",
};
const KIND_ICON: Record<string, IconName> = {
  milestone: "flag",
  completed: "check",
  ongoing: "activity",
  update: "mail",
  change: "alert",
};

export default async function Updates({
  params,
}: {
  params: { clientId: string };
}) {
  const client = await getClientOr404(params.clientId);
  const supabase = createClient();
  const { data } = await supabase
    .from("updates")
    .select("*")
    .eq("client_id", client.id)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  const updates = (data ?? []) as UpdateRow[];

  return (
    <>
      <PageTitle
        title="Latest updates and activity"
        subtitle="Completed work, ongoing activity and key milestones, newest first."
      />
      {updates.length === 0 ? (
        <Empty icon="activity" title="No activity posted yet">
          Updates from your RampRate team will appear here as work progresses.
          You will get an email when something new is posted.
        </Empty>
      ) : (
        <ol className="relative ml-4 space-y-6 border-l-2 border-slate-200 pl-8">
          {updates.map((u) => {
            const Ico = Icon[KIND_ICON[u.kind] ?? "mail"];
            return (
              <li key={u.id} className="relative">
                <span
                  className={`absolute -left-[50px] top-3 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-slate-50 ${DOT[u.kind]}`}
                >
                  <Ico size={16} />
                </span>
                <div className="card">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
                      {fmtRelative(u.occurred_on)
                        ? ` · ${fmtRelative(u.occurred_on)}`
                        : ""}
                    </span>
                  </div>
                  <h3 className="font-semibold leading-snug">{u.title}</h3>
                  {u.body && (
                    <p className="prose-narrow mt-1.5 whitespace-pre-line text-slate-700">
                      {u.body}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
