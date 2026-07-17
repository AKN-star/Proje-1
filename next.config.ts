import type { NextConfig } from "next";
// Alias ("@/") config bağlamında çözülmez — göreli import; launch
// koşulunun tek sahibi src/lib/launch.ts kalsın (split-brain olmasın).
import { isLaunched } from "./src/lib/launch";

const nextConfig: NextConfig = {
  // PGlite (WASM) bundler'dan geçince dosya yolları URL'e dönüşüp
  // ERR_INVALID_ARG_TYPE ile patlıyor — Node runtime'da harici bırakılır.
  serverExternalPackages: ["@electric-sql/pglite"],
  async headers() {
    // SITE_LAUNCHED=1 olana kadar hiçbir ortam indexlenmez (Faz 7 launch
    // anahtarı — layout.tsx metadata.robots ve app/robots.ts ile birlikte
    // aynı helper'dan okur; launch insan adımı = Vercel'de env + redeploy).
    if (isLaunched()) {
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
