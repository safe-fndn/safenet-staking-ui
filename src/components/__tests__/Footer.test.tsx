import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { LegalPage } from "@/lib/legal"

const legalPages: LegalPage[] = []

vi.mock("@/lib/legal", () => ({ LEGAL_PAGES: legalPages }))

function setLegalPages(pages: LegalPage[]) {
  legalPages.splice(0, legalPages.length, ...pages)
}

async function renderFooter() {
  const { Footer } = await import("../layout/Footer")
  render(<MemoryRouter><Footer /></MemoryRouter>)
}

beforeEach(() => {
  setLegalPages([
    { key: "terms", label: "Terms", path: "/terms", bundled: false, url: "https://example.com/terms" },
    { key: "privacy", label: "Privacy", path: "/privacy", bundled: false, url: "https://example.com/privacy" },
    { key: "imprint", label: "Imprint", path: "/imprint", bundled: false, url: "https://example.com/imprint" },
  ])
})

describe("Footer", () => {
  it("renders footer links", async () => {
    await renderFooter()

    expect(screen.getByText("Terms")).toBeInTheDocument()
    expect(screen.getByText("Privacy")).toBeInTheDocument()
    expect(screen.getByText("Imprint")).toBeInTheDocument()
    expect(screen.getByText("Documentation")).toBeInTheDocument()
    expect(screen.getByText("FAQ")).toBeInTheDocument()
  })

  it("opens external legal URLs in a new tab", async () => {
    await renderFooter()

    const link = screen.getByRole("link", { name: "Terms" })
    expect(link).toHaveAttribute("href", "https://example.com/terms")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("links bundled legal pages to the in-app route", async () => {
    setLegalPages([{ key: "terms", label: "Terms", path: "/terms", bundled: true, url: "" }])
    await renderFooter()

    const link = screen.getByRole("link", { name: "Terms" })
    expect(link).toHaveAttribute("href", "/terms")
    expect(link).not.toHaveAttribute("target")
  })

  it("hides legal links that are not configured", async () => {
    setLegalPages([{ key: "privacy", label: "Privacy", path: "/privacy", bundled: false, url: "" }])
    await renderFooter()

    expect(screen.queryByText("Privacy")).not.toBeInTheDocument()
    expect(screen.getByText("Documentation")).toBeInTheDocument()
  })
})
