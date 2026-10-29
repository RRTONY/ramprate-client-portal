"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { safeNext } from "@/lib/links";

const hashParams = () => new URLSearchParams(window.location.hash.slice(1));
const hasAuthHash = (h: URLSearchParams) =>
  h.has("access_token") || h.has("error_code");

/**
 * Finishes an invite or reset link that came back from Supabase's default email template, which
 * puts the session in the #fragment where the server cannot see it.
 */
export function AuthFinish({ next }: { next: string | null }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const h = hashParams();
    const access_token = h.get("access_token");
    const refresh_token = h.get("refresh_token");
    if (!access_token || !refresh_token) return setFailed(true);
    const fallback = ["invite", "recovery"].includes(h.get("type") ?? "")
      ? "/auth/set-password"
      : "/";
    createBrowserSupabase()
      .auth.setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) return setFailed(true);
        // A full page load, so the new session cookie reaches the server and middleware.
        window.location.replace(safeNext(next, fallback));
      });
  }, [next]);

  if (failed)
    return (
      <p className="text-sm text-slate-700" role="alert">
        That link has expired or was already used. Please{" "}
        <a href="/login" className="font-semibold text-brand-700 underline">
          request a new one
        </a>
        .
      </p>
    );
  return <p className="text-sm text-slate-600">Signing you in...</p>;
}

/** If Supabase sent the link to the home page instead, the sign-in page passes it on. */
export function AuthHashForward() {
  useEffect(() => {
    if (hasAuthHash(hashParams()))
      window.location.replace("/auth/finish" + window.location.hash);
  }, []);
  return null;
}
