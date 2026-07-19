import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Türkçe tarih biçimi (Faz 10 cleanup — 4 sayfa kopyasının tek kaynağı).
 * `withTime` admin panelinin saat/dakikalı varyantını verir. */
export function formatDate(date: Date, options: { withTime?: boolean } = {}): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
