/** Horizontal phases (for example Kickoff, Build, Launch) with the current one highlighted. */
export function PhaseTimeline({
  phases,
  current,
}: {
  phases: string[];
  current: number;
}) {
  if (!phases || phases.length === 0) return null;
  const cur = Math.min(Math.max(current, 0), phases.length - 1);
  return (
    <ol className="flex w-full items-start" aria-label="Engagement phases">
      {phases.map((p, i) => {
        const state = i < cur ? "done" : i === cur ? "current" : "todo";
        return (
          <li
            key={i}
            className="relative flex flex-1 flex-col items-center text-center"
            aria-current={state === "current" ? "step" : undefined}
          >
            {i > 0 && (
              <span
                className={`absolute left-[-50%] right-[50%] top-[15px] h-0.5 ${i <= cur ? "bg-brand-500" : "bg-slate-200"}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white ${
                state === "done"
                  ? "bg-brand-500 text-white"
                  : state === "current"
                    ? "bg-white text-brand-700 ring-brand-100 border-2 border-brand-500"
                    : "bg-slate-200 text-slate-500"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={`mt-2 px-1 text-xs ${state === "current" ? "font-bold text-brand-700" : state === "done" ? "font-semibold text-ink" : "text-slate-500"}`}
            >
              {p}
            </span>
            {state === "current" && (
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                We are here
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
