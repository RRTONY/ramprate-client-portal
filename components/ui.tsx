import { HEALTH_LABEL } from "@/lib/format";
import { Icon, type IconName } from "@/components/icons";

const HEALTH_STYLE: Record<string, string> = {
  on_track: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  needs_attention: "bg-amber-50 text-amber-700 ring-amber-200",
  at_risk: "bg-red-50 text-red-700 ring-red-200",
  on_hold: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function HealthBadge({ health }: { health: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${HEALTH_STYLE[health] ?? HEALTH_STYLE.on_hold}`}
    >
      {HEALTH_LABEL[health] ?? health}
    </span>
  );
}

export function Pill({
  children,
  tone = "purple",
}: {
  children: React.ReactNode;
  tone?: "purple" | "gray" | "green" | "amber";
}) {
  const tones = {
    purple: "bg-brand-50 text-brand-700 ring-brand-100",
    gray: "bg-slate-100 text-slate-600 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Empty({
  children,
  title,
  icon = "inbox",
}: {
  children: React.ReactNode;
  title?: string;
  icon?: IconName;
}) {
  const Ico = Icon[icon];
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <Ico size={24} />
      </span>
      {title && <div className="mb-1 font-semibold">{title}</div>}
      <div className="mx-auto max-w-md text-sm text-slate-600">{children}</div>
    </div>
  );
}

export function Notice({
  kind = "info",
  children,
}: {
  kind?: "info" | "error" | "success";
  children: React.ReactNode;
}) {
  const k = {
    info: "border-brand-100 bg-brand-50 text-brand-700",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[kind];
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${k}`}>
      {children}
    </div>
  );
}
