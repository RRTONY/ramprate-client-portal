"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Mode = "loading" | "enroll" | "verify" | "done";

/** TOTP two-step sign-in using any authenticator app (Google Authenticator, 1Password, Authy...). */
export function MfaForm({ forceEnroll }: { forceEnroll: boolean }) {
  const supabase = createBrowserSupabase();
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      // Remove any half-finished enrolment before starting a new one.
      for (const f of data?.totp ?? [])
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data: enr, error: e } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (e || !enr) {
        setError("We could not start setup. Please refresh and try again.");
        return;
      }
      setFactorId(enr.id);
      setQr(enr.totp.qr_code);
      setSecret(enr.totp.secret);
      setMode("enroll");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (ce || !ch) {
      setError("Could not start verification. Please try again.");
      setBusy(false);
      return;
    }
    const { error: ve } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.id,
      code: code.trim(),
    });
    if (ve) {
      setError("That code is not correct or has expired. Try the newest code.");
      setBusy(false);
      return;
    }
    setMode("done");
    // A full page load: a client-side move to "/" can reuse the page shown before the code
    // and leave a blank screen, and the server must see the new two-step session.
    window.location.replace("/");
  }

  if (mode === "loading")
    return <p className="text-sm text-slate-600">{error || "Loading..."}</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "enroll" && (
        <>
          <p className="text-sm text-slate-700">
            {forceEnroll
              ? "Two-step sign-in is required for your account. "
              : ""}
            Scan this code with an authenticator app, then enter the 6 digit
            code it shows.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR code to set up two-step sign-in"
            className="mx-auto h-44 w-44 rounded-lg border border-slate-200 bg-white p-2"
          />
          <p className="break-all text-center text-xs text-slate-500">
            Cannot scan? Enter this key:{" "}
            <span className="font-mono">{secret}</span>
          </p>
        </>
      )}
      {mode === "verify" && (
        <p className="text-sm text-slate-700">
          Enter the 6 digit code from your authenticator app.
        </p>
      )}
      <div>
        <label className="label" htmlFor="code">
          6 digit code
        </label>
        <input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="input text-center text-lg tracking-widest"
        />
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <button className="btn w-full" disabled={busy}>
        {busy
          ? "Checking..."
          : mode === "enroll"
            ? "Turn on and continue"
            : "Verify"}
      </button>
    </form>
  );
}
