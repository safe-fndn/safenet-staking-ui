import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

beforeEach(() => {
  vi.stubEnv("VITE_TERMS_URL", "https://example.com/terms")
  vi.stubEnv("VITE_PRIVACY_URL", "https://example.com/privacy")
  vi.stubEnv("VITE_IMPRINT_URL", "https://example.com/imprint")
})

describe("Footer", () => {
  it("renders footer links", async () => {
    // env vars are read at module scope, so re-import after stubbing
    vi.resetModules()
    const { Footer: F } = await import("../layout/Footer")
    render(<F />)

    expect(screen.getByText("Terms")).toBeInTheDocument()
    expect(screen.getByText("Privacy")).toBeInTheDocument()
    expect(screen.getByText("Imprint")).toBeInTheDocument()
    expect(screen.getByText("Documentation")).toBeInTheDocument()
    expect(screen.getByText("FAQ")).toBeInTheDocument()
  })
})
