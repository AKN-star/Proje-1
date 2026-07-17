import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
