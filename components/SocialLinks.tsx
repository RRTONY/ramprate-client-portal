const LINKEDIN =
  process.env.NEXT_PUBLIC_LINKEDIN_URL ||
  "https://www.linkedin.com/company/ramprate";
const X = process.env.NEXT_PUBLIC_X_URL || "https://twitter.com/ramprate";

function LinkedInIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Follow-us links with logos. Override the URLs with NEXT_PUBLIC_LINKEDIN_URL and NEXT_PUBLIC_X_URL. */
export function SocialLinks({ dark = false }: { dark?: boolean }) {
  const cls = dark
    ? "border-white/30 text-white hover:bg-white/10"
    : "border-slate-300 text-slate-700 hover:border-brand-500 hover:text-brand-700";
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}>
        Follow RampRate
      </span>
      <a
        href={LINKEDIN}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="RampRate on LinkedIn"
        title="LinkedIn"
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${cls}`}
      >
        <LinkedInIcon />
      </a>
      <a
        href={X}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="RampRate on X"
        title="X"
        className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${cls}`}
      >
        <XIcon />
      </a>
    </div>
  );
}
