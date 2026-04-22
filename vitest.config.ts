import path from "path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // @plausible-analytics/tracker uses the "module" field without "exports" or "main".
    // Vitest's Node resolver doesn't check "module" by default, so we include it here.
    mainFields: ["browser", "module", "jsnext:main", "jsnext"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/hooks/**", "src/components/**", "src/pages/**"],
      exclude: ["src/config/**", "src/abi/**", "src/data/**"],
    },
  },
})
