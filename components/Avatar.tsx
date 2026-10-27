const COLORS = [
  "bg-brand-500 text-white",
  "bg-violet text-white",
  "bg-sky-600 text-white",
  "bg-emerald-600 text-white",
  "bg-amber-600 text-white",
  "bg-rose-600 text-white",
  "bg-slate-700 text-white",
  "bg-teal-600 text-white",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/** Round initials avatar. Colour is stable per name. */
export function Avatar({
  name,
  size = 36,
  ring = false,
}: {
  name: string;
  size?: number;
  ring?: boolean;
}) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={`inline-flex flex-none items-center justify-center rounded-full font-semibold ${COLORS[h % COLORS.length]} ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
