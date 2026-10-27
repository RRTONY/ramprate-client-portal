"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Icon } from "@/components/icons";

const STEPS: { key: string | null; title: string; text: string }[] = [
  {
    key: null,
    title: "Welcome to your portal",
    text: "Everything about your work with RampRate lives here. This 30 second tour shows you where things are.",
  },
  {
    key: "overview",
    title: "Overview",
    text: "Start here each visit. It shows where things stand and anything we need from you.",
  },
  {
    key: "progress",
    title: "Progress and next steps",
    text: "See what is done, what is underway, upcoming meetings and anything waiting on you.",
  },
  {
    key: "updates",
    title: "Activity",
    text: "A timeline of completed work and milestones, newest first.",
  },
  {
    key: "documents",
    title: "Documents",
    text: "Your NDA, agreements, statements of work and reports. View or download any time.",
  },
  {
    key: "queries",
    title: "Questions",
    text: "Ask anything. It goes straight to your engagement owner and our admin team, and you are emailed when we reply.",
  },
  {
    key: "team",
    title: "Your team",
    text: "Meet your team, email them or book a meeting in one click.",
  },
];
const DONE_KEY = "rr-tour-done-v1";

type Rect = { top: number; left: number; width: number; height: number };

/** First-visit guided tour with a spotlight ring on each tab. Can be re-opened from the "Take a tour" button. */
export function Tour({ auto }: { auto: boolean }) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

  const close = useCallback(() => {
    setStep(null);
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const open = () => setStep(0);
    window.addEventListener("rr-start-tour", open);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (auto) {
      try {
        if (!localStorage.getItem(DONE_KEY))
          t = setTimeout(() => setStep(0), 1200);
      } catch {
        /* ignore */
      }
    }
    return () => {
      window.removeEventListener("rr-start-tour", open);
      if (t) clearTimeout(t);
    };
  }, [auto]);

  const measure = useCallback(() => {
    if (step === null) return;
    const key = STEPS[step].key;
    if (!key) return setRect(null);
    const el = document.querySelector<HTMLElement>(`[data-tour="${key}"]`);
    if (!el) return setRect(null);
    el.scrollIntoView({ block: "nearest", inline: "center" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    if (step === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight")
        setStep((s) => (s === null ? s : Math.min(STEPS.length - 1, s + 1)));
      if (e.key === "ArrowLeft")
        setStep((s) => (s === null ? s : Math.max(0, s - 1)));
    };
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, [step, measure, close]);

  if (step === null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const popW = Math.min(340, w - 24);
  const left = rect
    ? Math.max(
        12,
        Math.min(w - popW - 12, rect.left + rect.width / 2 - popW / 2),
      )
    : Math.max(12, (w - popW) / 2);
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const top = rect ? rect.top + rect.height + 16 : Math.max(24, h * 0.28);
  const arrowLeft = rect
    ? Math.max(18, Math.min(popW - 18, rect.left + rect.width / 2 - left))
    : 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/45"
        onClick={close}
        aria-hidden="true"
      />
      {rect && (
        <div
          className="tour-ring"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          aria-hidden="true"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Portal tour"
        className="tour-pop fixed z-[70] rounded-2xl bg-white p-5 text-ink shadow-2xl ring-1 ring-black/10"
        style={{ top, left, width: popW }}
      >
        {rect && (
          <span
            className="absolute -top-2 h-4 w-4 rotate-45 bg-white ring-1 ring-black/5"
            style={{ left: arrowLeft - 8 }}
            aria-hidden="true"
          />
        )}
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">
          Step {step + 1} of {STEPS.length}
        </div>
        <h2 className="text-lg font-bold">{s.title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{s.text}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={close}
            className="text-sm font-semibold text-slate-600 hover:text-ink"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn-secondary !py-1.5"
              >
                Back
              </button>
            )}
            <button
              type="button"
              autoFocus
              onClick={() => (last ? close() : setStep(step + 1))}
              className="btn !py-1.5"
            >
              {last ? "Got it" : step === 0 ? "Start tour" : "Next"}{" "}
              {!last && <Icon.arrow size={16} />}
            </button>
          </div>
        </div>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-brand-500" : "w-1.5 bg-slate-300"}`}
            />
          ))}
        </div>
      </div>
    </>
  );
}

export function TourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("rr-start-tour"))}
      className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
    >
      <Icon.compass size={14} /> Take a quick tour
    </button>
  );
}
