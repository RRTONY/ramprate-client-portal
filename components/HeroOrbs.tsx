"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

type Props = {
  base: string;
  done: number;
  total: number;
  meetingDay: string | null;
  meetingRel: string | null;
  waiting: number;
};

/** Hover enlarges, click plays a quick press-and-ripple animation, then opens the matching page. */
function Orb({
  href,
  label,
  hint,
  children,
  attention,
  delay,
}: {
  href: string;
  label: string;
  hint: string;
  children: React.ReactNode;
  attention?: boolean;
  delay: number;
}) {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);
  const [ripple, setRipple] = useState(0);
  function go() {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return router.push(href);
    setPressed(false);
    requestAnimationFrame(() => {
      setPressed(true);
      setRipple((n) => n + 1);
    });
    setTimeout(() => router.push(href), 420);
  }
  return (
    <div
      className="orb-wrap group flex flex-col items-center"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="orb-float" style={{ animationDelay: `${delay * 3}ms` }}>
        <div className="relative">
          {ripple > 0 && (
            <span key={ripple} className="orb-ripple" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={go}
            aria-label={`${label}. ${hint}`}
            className={`orb relative flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white/[.14] text-white ring-1 ring-white/35 backdrop-blur-sm sm:h-[112px] sm:w-[112px] ${pressed ? "is-pressed" : ""} ${attention ? "orb-attn" : ""}`}
          >
            {children}
          </button>
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-white/90">
          {label}
        </div>
        <div className="orb-hint mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/80">
          {hint} <Icon.arrow size={11} />
        </div>
      </div>
    </div>
  );
}

export function HeroOrbs({
  base,
  done,
  total,
  meetingDay,
  meetingRel,
  waiting,
}: Props) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return setShown(pct);
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start - 300) / 1200);
      setShown(Math.round(pct * (k < 0 ? 0 : 1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [pct]);
  const C = 2 * Math.PI * 44;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      <Orb
        href={`${base}/progress`}
        label="Progress"
        hint="See details"
        delay={150}
      >
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="5"
            stroke="rgba(255,255,255,.22)"
          />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke="#fff"
            strokeDasharray={C}
            strokeDashoffset={C - (C * shown) / 100}
          />
        </svg>
        <span className="text-2xl font-bold leading-none sm:text-3xl">
          {shown}%
        </span>
        <span className="mt-1 text-[10px] text-white/85 sm:text-xs">
          {done} of {total} done
        </span>
      </Orb>

      <Orb
        href={`${base}/progress`}
        label="Next meeting"
        hint="Agenda and link"
        delay={300}
      >
        <Icon.calendar size={22} className="mb-0.5" />
        <span className="px-2 text-center text-sm font-bold leading-tight sm:text-base">
          {meetingDay ?? "None yet"}
        </span>
        <span className="text-[10px] text-white/85 sm:text-xs">
          {meetingDay ? meetingRel || "" : "to be booked"}
        </span>
      </Orb>

      <Orb
        href={`${base}/progress`}
        label={waiting ? "Waiting on you" : "All clear"}
        hint={waiting ? "See what we need" : "Nothing needed"}
        delay={450}
        attention={waiting > 0}
      >
        {waiting > 0 ? (
          <>
            <span
              className="absolute inset-0 rounded-full bg-amber-400/25"
              aria-hidden="true"
            />
            <Icon.alert size={20} className="relative text-amber-200" />
            <span className="relative text-3xl font-bold leading-none">
              {waiting}
            </span>
            <span className="relative text-[10px] text-amber-100 sm:text-xs">
              to do
            </span>
          </>
        ) : (
          <>
            <Icon.check size={30} className="text-emerald-200" />
            <span className="text-[10px] text-white/85 sm:text-xs">
              nothing needed
            </span>
          </>
        )}
      </Orb>
    </div>
  );
}
