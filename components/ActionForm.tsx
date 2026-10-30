"use client";

import { useEffect, useRef, useState } from "react";
import { Notice } from "@/components/ui";
import type { ActionResult } from "@/lib/types";

/**
 * A form for a server action that returns `{ error }` on failure. On success it clears the
 * fields (unless `keepValues`) and shows a short "Saved" message; on failure it keeps what was
 * typed and shows the error above the fields.
 */
export function ActionForm({
  action,
  children,
  className,
  savedText = "Saved",
  keepValues = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  savedText?: string;
  keepValues?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(0), 3500);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <form
      ref={ref}
      className={className}
      action={async (fd) => {
        setError(null);
        const res = await action(fd);
        if (res?.error) {
          setError(res.error);
          return;
        }
        if (!keepValues) ref.current?.reset();
        setSaved(Date.now());
      }}
    >
      {error && (
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
        {saved > 0 && (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-lg">
            {savedText}
          </span>
        )}
      </div>
    </form>
  );
}
