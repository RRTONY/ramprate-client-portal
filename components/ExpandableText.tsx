"use client";

import { useState } from "react";

/** Shows the first few lines with a Read more toggle. Short text is shown in full. */
export function ExpandableText({
  text,
  lines = 3,
  className = "",
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > 260 || text.split("\n").length > lines + 1;
  return (
    <div>
      <p
        className={`${open || !long ? "whitespace-pre-line" : ""} ${className}`}
        style={
          !open && long
            ? {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }
            : undefined
        }
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-1 text-sm font-semibold text-brand-700 hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
