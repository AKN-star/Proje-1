"use client";

/** "Linki kopyala" düğmesi (Faz 9 T5) — pano API'si; 2 sn onay gösterir. */
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      // Query param'sız kanonik link paylaşılır.
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz geç — buton işlevsiz kalır, kırılmaz.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
    >
      {copied ? "Kopyalandı ✓" : "Linki kopyala"}
    </button>
  );
}
