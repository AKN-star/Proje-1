"use client";

/**
 * Tema düğmesi (Faz 8 T6): sistem → açık → koyu döngüsü. Tercih
 * localStorage'da ("theme"); ilk boyamadan önce layout'taki inline
 * script uygular (FOUC yok). YENİ BAĞIMLILIK YOK (next-themes değil).
 */
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

const LABELS: Record<Theme, string> = {
  system: "Tema: Sistem",
  light: "Tema: Açık",
  dark: "Tema: Koyu",
};

const ORDER: Theme[] = ["system", "light", "dark"];

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  // SSR'da tercih bilinmez — mount olana dek nötr etiket basılır
  // (hydration uyuşmazlığı olmasın).
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  const cycle = () => {
    if (!theme) return;
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
    } else {
      localStorage.setItem("theme", next);
    }
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="underline-offset-2 hover:underline"
    >
      {theme ? LABELS[theme] : "Tema"}
    </button>
  );
}
