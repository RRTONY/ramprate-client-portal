"use client";

import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui";

/** Place inside a form: covers the screen with a loader while the form is being sent. */
export function PendingOverlay({ label }: { label: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/60 text-brand-600 backdrop-blur-sm">
      <Spinner label={label} className="h-10 w-10" />
      <p aria-hidden className="text-sm font-medium text-slate-700">
        {label}
      </p>
    </div>
  );
}
