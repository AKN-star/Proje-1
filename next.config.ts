import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM) bundler'dan geçince dosya yolları URL'e dönüşüp
  // ERR_INVALID_ARG_TYPE ile patlıyor — Node runtime'da harici bırakılır.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    return [
      {
        // Yayına (Faz 7) kadar hiçbir ortam indexlenmez; launch'ta bu blok
        // ve layout.tsx'teki metadata.robots birlikte kaldırılır.
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
