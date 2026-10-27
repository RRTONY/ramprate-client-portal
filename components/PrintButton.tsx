"use client";

import { Icon } from "@/components/icons";

export function PrintButton({
  label = "Print or save as PDF",
}: {
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-secondary no-print !py-1.5"
    >
      <Icon.print size={16} /> {label}
    </button>
  );
}
