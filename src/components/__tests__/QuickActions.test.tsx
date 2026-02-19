import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { QuickActions } from "../dashboard/QuickActions"

const mockNavigate = vi.fn()
const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useWithdrawals", () => ({
  useNextClaimable: () => ({ data: undefined }),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe("QuickActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when not connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })

    const { container } = render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    )

    expect(container.firstChild).toBeNull()
  })

  it("shows action buttons when connected", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })

    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    )

    expect(screen.getByRole("button", { name: /^Delegate$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Undelegate$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Withdraw/i })).toBeInTheDocument()
  })

  it("navigates to validators on Delegate click", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: /^Delegate$/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/validators")
  })

  it("navigates to withdrawals on Claim click", async () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    const user = userEvent.setup()

    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole("button", { name: /Withdraw/i }))
    expect(mockNavigate).toHaveBeenCalledWith("/withdrawals")
  })
})
