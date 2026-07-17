import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // PGlite'ın (WASM) soğuk başlangıcı CI'da varsayılan 5s'yi aşabiliyor.
    testTimeout: 20000,
    hookTimeout: 30000,
    // Birden çok PGlite (WASM) örneği paralel test dosyalarında birbirini
    // boğup hook timeout'una yol açıyor — dosyalar seri koşulur.
    fileParallelism: false,
  },
});
