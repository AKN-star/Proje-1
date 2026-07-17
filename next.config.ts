import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (WASM) bundler'dan geçince dosya yolları URL'e dönüşüp
  // ERR_INVALID_ARG_TYPE ile patlıyor — Node runtime'da harici bırakılır.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    // SITE_LAUNCHED=1 olana kadar hiçbir ortam indexlenmez (Faz 7 launch
    // anahtarı — layout.tsx metadata.robots ve app/robots.ts ile birlikte
    // aynı env'den okur; launch insan adımı = Vercel'de env + redeploy).
    if (process.env.SITE_LAUNCHED === "1") {
      return [];
    }
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
