"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

/** Light/dark switch. Remembers the choice in this browser. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 hover:border-brand-500 hover:text-brand-700"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Icon.sun size={16} /> : <Icon.moon size={16} />}
    </button>
  );
}
