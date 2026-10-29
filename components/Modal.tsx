"use client";

import { useId, useRef } from "react";
import { FiX } from "react-icons/fi";

/**
 * A button that opens a pop-up window (native <dialog>: focus is kept inside, Esc closes it).
 * Forms inside post to server actions as usual; the page reload after saving closes it.
 */
export function Modal({
  title,
  trigger,
  triggerLabel,
  triggerClassName = "btn",
  children,
}: {
  title: string;
  trigger: React.ReactNode;
  /** Screen-reader name and hover hint, needed when the trigger is only an icon. */
  triggerLabel?: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="w-[calc(100%-2rem)] max-w-lg rounded-xl bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
        onClick={(e) => e.target === ref.current && ref.current?.close()}
      >
        <div className="card text-left">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close"
              title="Close"
              onClick={() => ref.current?.close()}
              className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <FiX aria-hidden className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  );
}

export const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-brand-500 hover:text-brand-700";
export const iconButtonDanger =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50";
