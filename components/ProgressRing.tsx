/** Circular progress. Shows a percentage with the label underneath. */
export function ProgressRing({
  done,
  total,
  size = 76,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`${pct} percent complete, ${done} of ${total} items`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth="8"
            className="stroke-slate-200"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-brand-500"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-bold">
          {pct}%
        </div>
      </div>
    </div>
  );
}
