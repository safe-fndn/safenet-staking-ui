import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { OnboardingBanner } from "../onboarding/OnboardingBanner"

const mockUseAccount = vi.fn()
const mockUseUserTotalStake = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useStakingReads", () => ({
  useUserTotalStake: () => mockUseUserTotalStake(),
}))

describe("OnboardingBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockUseAccount.mockReturnValue({ isConnected: false })
    mockUseUserTotalStake.mockReturnValue({ data: undefined })
  })

  it("shows onboarding steps for new visitor", () => {
    render(<OnboardingBanner />)

    expect(screen.getByText("Connect your wallet")).toBeInTheDocument()
    expect(screen.getByText("Select a validator to stake your tokens")).toBeInTheDocument()
    expect(screen.getByText("Track your rewards")).toBeInTheDocument()
  })

  it("returns null when dismissed", () => {
    localStorage.setItem("onboarding_dismissed", "true")

    const { container } = render(<OnboardingBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("returns null when connected with existing stake", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseUserTotalStake.mockReturnValue({ data: 100n * 10n ** 18n })

    const { container } = render(<OnboardingBanner />)

    expect(container.firstChild).toBeNull()
  })

  it("shows banner when connected but no stake yet", () => {
    mockUseAccount.mockReturnValue({ isConnected: true })
    mockUseUserTotalStake.mockReturnValue({ data: 0n })

    render(<OnboardingBanner />)

    expect(screen.getByText("Connect your wallet")).toBeInTheDocument()
  })

  it("dismiss button sets localStorage and hides banner", async () => {
    const user = userEvent.setup()
    render(<OnboardingBanner />)

    await user.click(screen.getByLabelText("Dismiss onboarding"))

    expect(localStorage.getItem("onboarding_dismissed")).toBe("true")
    expect(screen.queryByText("Connect your wallet")).not.toBeInTheDocument()
  })
})
