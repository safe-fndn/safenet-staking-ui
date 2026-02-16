import "@testing-library/jest-dom/vitest"
import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Auto-cleanup rendered components after each test.
// Required because globals:false means @testing-library can't find afterEach automatically.
afterEach(() => {
  cleanup()
})

// Stub lucide-react icons globally — they use dynamic ESM imports that jsdom can't resolve.
// Each mock returns a simple span so components render without errors.
vi.mock("lucide-react/dist/esm/icons/loader-2", () => ({
  default: () => null,
}))
vi.mock("lucide-react/dist/esm/icons/info", () => ({
  default: () => null,
}))
vi.mock("lucide-react/dist/esm/icons/fuel", () => ({
  default: () => null,
}))
vi.mock("lucide-react/dist/esm/icons/check-circle", () => ({
  default: () => null,
}))
