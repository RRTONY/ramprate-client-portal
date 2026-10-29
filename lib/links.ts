/** Only same-site paths, so a crafted link cannot send someone to another site after sign-in. */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\")
    ? raw
    : fallback;
}
