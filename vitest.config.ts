import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Vitest 4 の公式推奨は pool オプションを top-level に置くこと。ただし
// `vitest/config` が再エクスポートする Vite 型にはまだ反映されていないため、
// 直下の `poolOptions` プロパティに ts-expect-error を当てて許容する。
// devcontainer の CPU が `next dev` と食い合うと並列 fork でワーカー起動
// タイムアウトが起きるため、threads pool の singleThread で逐次実行する。
export default defineConfig({
  plugins: [react()],
  // @ts-expect-error poolOptions is valid at runtime but absent from Vite's public type
  poolOptions: {
    threads: { singleThread: true },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e", "tests-e2e"],
    pool: "threads",
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/**/*.{test,spec}.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "server-only": resolve(__dirname, "./vitest.server-only-stub.ts"),
    },
  },
});
