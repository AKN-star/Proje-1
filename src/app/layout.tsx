import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Link from "next/link";
import { brand } from "@/config/brand";
import { isLaunched } from "@/lib/launch";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s — ${brand.name}`,
  },
  description: brand.tagline.tr,
  // SITE_LAUNCHED=1 olana kadar arama motorlarına kapalı (Faz 7 launch
  // anahtarı — next.config.ts header'ı ve app/robots.ts ile birlikte).
  robots: isLaunched() ? { index: true, follow: true } : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        {children}
        <footer className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-4 px-6 py-8 text-xs text-neutral-500">
          <span>© {new Date().getFullYear()} {brand.name}</span>
          <Link href="/nasil-calisir" className="underline-offset-2 hover:underline">
            Nasıl çalışır?
          </Link>
          <Link href="/kvkk" className="underline-offset-2 hover:underline">
            KVKK Aydınlatma
          </Link>
          <Link href="/kullanim-sartlari" className="underline-offset-2 hover:underline">
            Kullanım Şartları
          </Link>
          <Link href="/ayarlar" className="underline-offset-2 hover:underline">
            Ayarlar
          </Link>
        </footer>
      </body>
    </html>
  );
}
