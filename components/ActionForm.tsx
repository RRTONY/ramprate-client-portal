"use client";

import { useEffect, useRef, useState } from "react";
import { isRedirectError } from "next/dist/client/components/redirect";
import { Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

const OFFLINE = "That did not save. Please check your connection and try again.";

/**
 * A form for a server action that returns `{ error }` on failure. On success it clears the
 * fields (unless `keepValues`) and shows a short "Saved" message; on failure it keeps what was
 * typed and shows the error above the fields. `compact` forms (a single icon button in a row)
 * show the error as a pop-up message instead, so the row layout does not break.
 */
export function ActionForm({
  action,
  children,
  className,
  savedText = "Saved",
  keepValues = false,
  compact = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  savedText?: string;
  keepValues?: boolean;
  compact?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(0), 3500);
    return () => clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    if (!compact || !error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [compact, error]);

  return (
    <form
      ref={ref}
      className={className}
      action={async (fd) => {
        setError(null);
        let res: ActionResult;
        try {
          res = await action(fd);
        } catch (e) {
          // A redirect from the action is how Next.js moves on; let it through.
          if (isRedirectError(e)) throw e;
          setError(OFFLINE);
          return;
        }
        if (res?.error) {
          setError(res.error);
          return;
        }
        if (!keepValues) ref.current?.reset();
        setSaved(Date.now());
      }}
    >
      {error && !compact && (
        <div className="col-span-full" role="alert">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6"
      >
        {error && compact ? (
          <span
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-lg"
          >
            {error}
          </span>
        ) : (
          saved > 0 && (
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-lg">
              {savedText}
            </span>
          )
        )}
      </div>
    </form>
  );
}
