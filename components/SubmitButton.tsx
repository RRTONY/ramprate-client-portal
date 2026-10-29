"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText = "Saving...",
  className = "btn",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const ref = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);

  // In a pop-up, close it once the save has finished; the page shows the result.
  useEffect(() => {
    if (wasPending.current && !pending) ref.current?.closest("dialog")?.close();
    wasPending.current = pending;
  }, [pending]);

  return (
    <button ref={ref} type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <Spinner label={pendingText} /> : children}
    </button>
  );
}
