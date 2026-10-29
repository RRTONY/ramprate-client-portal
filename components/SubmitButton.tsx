"use client";

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
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? <Spinner label={pendingText} /> : children}
    </button>
  );
}
