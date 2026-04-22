import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e", "tests-e2e"],
    // devcontainer の CPU / メモリが豊富ではなく、`next dev` が常駐している
    // 時に並列 fork だとワーカー起動タイムアウトが頻発するため単一プロセスで
    // 逐次実行する。vitest の公開型に `poolOptions` が載っていないので
    // ts-expect-error で一時的に許可する。
    pool: "forks",
    // @ts-expect-error poolOptions is not yet in vitest/config's public types.
    poolOptions: {
      forks: { singleFork: true },
    },
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
