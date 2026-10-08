import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { ValidatorDetailPage } from "../ValidatorDetailPage"
import { TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"
import { useValidators, type ValidatorInfo } from "@/hooks/useValidators"
import { useUserStakeOnValidator } from "@/hooks/useStakingReads"
import { INACTIVE_WARNING, LOW_PARTICIPATION_WARNING } from "@/lib/delegationWarnings"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return {
    ...actual,
    useValidators: vi.fn(() => ({
      data: [...MOCK_VALIDATORS],
      isLoading: false,
    })),
  }
})

vi.mock("@/hooks/useStakingReads", () => ({
  useValidatorTotalStake: vi.fn(() => ({ data: 5000n * 10n ** 18n, isLoading: false })),
  useUserStakeOnValidator: vi.fn(() => ({ data: 100n * 10n ** 18n, isLoading: false })),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}))

vi.mock("@/components/staking/DelegateDialog", () => ({
  DelegateDialog: () => null,
}))

vi.mock("@/components/staking/UndelegateDialog", () => ({
  UndelegateDialog: () => null,
}))

function renderWithRoute(address: string) {
  return render(
    <MemoryRouter initialEntries={[`/validators/${address}`]}>
      <TooltipProvider>
        <Routes>
          <Route path="/validators/:address" element={<ValidatorDetailPage />} />
        </Routes>
      </TooltipProvider>
    </MemoryRouter>,
  )
}

describe("ValidatorDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAccount.mockReturnValue({ isConnected: true })
  })

  it("shows invalid address message for bad address", () => {
    renderWithRoute("not-an-address")

    expect(screen.getByText("Invalid validator address.")).toBeInTheDocument()
  })

  it("shows validator details for valid address", () => {
    renderWithRoute(TEST_ACCOUNTS.validator1)

    expect(screen.getByText("Gnosis")).toBeInTheDocument()
    expect(screen.getByText(/Commission/)).toBeInTheDocument()
    expect(screen.getByText(/Participation \(14d\)/)).toBeInTheDocument()
  })

  it("shows stake and unstake buttons when connected", () => {
    renderWithRoute(TEST_ACCOUNTS.validator1)

    expect(screen.getByRole("button", { name: "Stake" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unstake" })).toBeInTheDocument()
  })

  it("hides action buttons when disconnected", () => {
    mockUseAccount.mockReturnValue({ isConnected: false })
    renderWithRoute(TEST_ACCOUNTS.validator1)

    expect(screen.queryByRole("button", { name: "Stake" })).not.toBeInTheDocument()
  })

  it("shows back link", () => {
    renderWithRoute(TEST_ACCOUNTS.validator1)

    expect(screen.getByText("Back to Validators")).toBeInTheDocument()
  })

  it("shows not found for unknown valid address", async () => {
    const mod = await import("@/hooks/useValidators")
    vi.mocked(mod.useValidators).mockReturnValueOnce({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof mod.useValidators>)

    renderWithRoute("0x0000000000000000000000000000000000000001")

    expect(screen.getByText("Validator not found.")).toBeInTheDocument()
  })

  describe("delegation warnings", () => {
    const [gnosis, greenfield] = MOCK_VALIDATORS

    function mockValidators(validators: ValidatorInfo[]) {
      vi.mocked(useValidators).mockReturnValue({
        data: validators,
        isLoading: false,
      } as unknown as ReturnType<typeof useValidators>)
    }

    function mockUserStake(amount: bigint) {
      vi.mocked(useUserStakeOnValidator).mockReturnValue({
        data: amount,
        isLoading: false,
      } as unknown as ReturnType<typeof useUserStakeOnValidator>)
    }

    beforeEach(() => {
      mockUserStake(100n * 10n ** 18n)
    })

    it("shows no warnings for a healthy validator", () => {
      mockValidators([...MOCK_VALIDATORS])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("shows the inactive warning only", () => {
      mockValidators([{ ...gnosis, isActive: false }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      const alerts = screen.getAllByRole("alert")
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toHaveTextContent(INACTIVE_WARNING)
    })

    it("shows the low participation warning only", () => {
      mockValidators([{ ...gnosis, participationRate: 60 }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      const alerts = screen.getAllByRole("alert")
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toHaveTextContent(LOW_PARTICIPATION_WARNING)
    })

    it("shows both warnings when both conditions apply", () => {
      mockValidators([{ ...gnosis, isActive: false, participationRate: 50 }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      const alerts = screen.getAllByRole("alert")
      expect(alerts).toHaveLength(2)
      expect(alerts[0]).toHaveTextContent(INACTIVE_WARNING)
      expect(alerts[1]).toHaveTextContent(LOW_PARTICIPATION_WARNING)
    })

    it("does not warn at exactly 75% participation", () => {
      mockValidators([{ ...gnosis, participationRate: 75 }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("only warns about the validator being viewed", () => {
      mockValidators([gnosis, { ...greenfield, isActive: false, participationRate: 10 }])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("shows no warnings without stake on the validator", () => {
      mockValidators([{ ...gnosis, isActive: false, participationRate: 50 }, greenfield])
      mockUserStake(0n)
      renderWithRoute(TEST_ACCOUNTS.validator1)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("shows no warnings when disconnected", () => {
      mockUseAccount.mockReturnValue({ isConnected: false })
      mockValidators([{ ...gnosis, isActive: false, participationRate: 50 }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    })

    it("places warnings between the back link and the validator card", () => {
      mockValidators([{ ...gnosis, isActive: false }, greenfield])
      renderWithRoute(TEST_ACCOUNTS.validator1)

      const alert = screen.getByRole("alert")
      expect(screen.getByText("Back to Validators").compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
      expect(alert.compareDocumentPosition(screen.getByText("Gnosis"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    })
  })
})
