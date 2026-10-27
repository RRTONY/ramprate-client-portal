const TZ = "America/Los_Angeles";

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  // Date-only strings (YYYY-MM-DD) must not shift across timezones.
  const date =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? new Date(d + "T12:00:00Z")
      : new Date(d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone:
      typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? "UTC" : TZ,
  });
}

/** Meetings are shown in Pacific time, with the zone label. */
export function fmtDateTime(d: string | Date): string {
  const date = new Date(d);
  const day = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: TZ,
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
    timeZoneName: "short",
  });
  return `${day}, ${time}`;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Converts a <input type="datetime-local"> value, interpreted as Pacific time, to an ISO string. */
export function pacificLocalToISO(local: string): string {
  // Find the Pacific offset for that wall-clock time by probing.
  const [datePart, timePart] = local.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  const asUTC = Date.UTC(y, m - 1, d, hh, mm);
  for (const offsetHours of [7, 8]) {
    const candidate = new Date(asUTC + offsetHours * 3600_000);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      day: "2-digit",
    }).formatToParts(candidate);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (get("day") === d && get("hour") % 24 === hh && get("minute") === mm)
      return candidate.toISOString();
  }
  return new Date(asUTC + 8 * 3600_000).toISOString();
}

export const HEALTH_LABEL: Record<string, string> = {
  on_track: "On track",
  needs_attention: "Needs attention",
  at_risk: "At risk",
  on_hold: "On hold",
};

export const PROGRESS_LABEL: Record<string, string> = {
  next_step: "Next step",
  in_progress: "In progress",
  upcoming: "Upcoming",
  pending: "Waiting on you",
  completed: "Completed",
};

export const KIND_LABEL: Record<string, string> = {
  milestone: "Milestone",
  completed: "Completed",
  ongoing: "Ongoing",
  update: "Update",
  change: "Important change",
};

/** "today", "tomorrow", "in 3 days", "2 days ago" for a date or timestamp. Compared by Pacific calendar day. */
export function fmtRelative(d: string | Date | null | undefined): string {
  if (!d) return "";
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const target =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? d
      : key(new Date(d));
  const today = key(new Date());
  const diff = Math.round(
    (Date.parse(target + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) /
      86400000,
  );
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 1 && diff < 31) return `in ${diff} days`;
  if (diff < -1 && diff > -31) return `${-diff} days ago`;
  return "";
}

/** Short weekday date like "Thu, Oct 29". */
export function fmtShortDay(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? new Date(d + "T12:00:00Z")
      : new Date(d);
  const tz =
    typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? "UTC" : TZ;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}
