// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// base: './' 讓 build 出的資源使用相對路徑，可以丟到任何子目錄部署
// （例：events.everrich-group.com/luckydraw2026/）
export default defineConfig({
  vite: {
    base: "./",
  },
});
