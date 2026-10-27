import type { ReactElement } from "react";

type P = { className?: string; size?: number };
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export const Icon = {
  home: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  progress: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  ),
  activity: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  documents: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  chat: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  ),
  team: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M18 14.3c2 .8 3 2.7 3 5.7" />
    </svg>
  ),
  calendar: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  check: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  alert: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.01" />
    </svg>
  ),
  download: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M12 4v11" />
      <path d="M7 11l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  ),
  eye: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  shield: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  mail: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  video: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  ),
  print: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M7 9V3h10v6" />
      <rect x="4" y="9" width="16" height="9" rx="2" />
      <path d="M7 15h10v6H7z" />
    </svg>
  ),
  sun: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
    </svg>
  ),
  moon: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
    </svg>
  ),
  arrow: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  compass: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </svg>
  ),
  inbox: ({ className, size = 28 }: P) => (
    <svg {...base(size, className)}>
      <path d="M3 13l3-8h12l3 8" />
      <path d="M3 13v6h18v-6h-5l-1 2h-6l-1-2z" />
    </svg>
  ),
  flag: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
    </svg>
  ),
  link: ({ className, size = 18 }: P) => (
    <svg {...base(size, className)}>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />
    </svg>
  ),
} satisfies Record<string, (p: P) => ReactElement>;

export type IconName = keyof typeof Icon;

/** File type chip: PDF, Word, Excel, image, or generic. */
export function FileTypeIcon({ fileName }: { fileName: string }) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const map: Record<string, { label: string; cls: string }> = {
    pdf: { label: "PDF", cls: "bg-red-50 text-red-700 ring-red-200" },
    doc: { label: "DOC", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    docx: { label: "DOC", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
    xls: {
      label: "XLS",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    xlsx: {
      label: "XLS",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    csv: {
      label: "CSV",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    ppt: { label: "PPT", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
    pptx: { label: "PPT", cls: "bg-orange-50 text-orange-700 ring-orange-200" },
    png: { label: "IMG", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
    jpg: { label: "IMG", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
    jpeg: { label: "IMG", cls: "bg-violet-50 text-violet-700 ring-violet-200" },
    zip: { label: "ZIP", cls: "bg-slate-100 text-slate-700 ring-slate-200" },
  };
  const t = map[ext] ?? {
    label: (ext || "FILE").slice(0, 4).toUpperCase(),
    cls: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  return (
    <span
      className={`flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[11px] font-bold ring-1 ${t.cls}`}
      aria-label={`${t.label} file`}
    >
      {t.label}
    </span>
  );
}
