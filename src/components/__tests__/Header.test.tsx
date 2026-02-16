import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { Header } from "../layout/Header"

const mockToggle = vi.fn()

vi.mock("@/hooks/useDarkMode", () => ({
  useDarkMode: () => ({ isDark: false, toggle: mockToggle }),
}))

vi.mock("@/components/wallet/ConnectButton", () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

describe("Header", () => {
  it("renders logo and nav links", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
    expect(screen.getByText("Validators")).toBeInTheDocument()
    expect(screen.getByText("Withdrawals")).toBeInTheDocument()
  })

  it("renders dark mode toggle button", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText("Switch to dark mode")).toBeInTheDocument()
  })

  it("calls toggle on dark mode button click", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText("Switch to dark mode"))
    expect(mockToggle).toHaveBeenCalled()
  })

  it("renders mobile menu button", () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText("Open menu")).toBeInTheDocument()
  })

  it("toggles mobile menu on click", async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText("Open menu"))
    expect(screen.getByLabelText("Close menu")).toBeInTheDocument()
  })
})
