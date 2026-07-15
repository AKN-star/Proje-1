import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { brand } from "@/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.tagline.tr,
  // Yayın (Faz 7) öncesi arama motorlarına kapalı — next.config.ts'teki
  // X-Robots-Tag header'ı ile birlikte kaldırılacak.
  robots: { index: false, follow: false },
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
      </body>
    </html>
  );
}
