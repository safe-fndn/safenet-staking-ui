import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { ValidatorDetailPage } from "../ValidatorDetailPage"
import { TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"

const mockUseAccount = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
}))

vi.mock("@/hooks/useValidators", () => ({
  useValidators: vi.fn(() => ({
    data: [...MOCK_VALIDATORS],
    isLoading: false,
  })),
  findValidator: (validators: unknown[], address: string) => {
    if (!validators) return null
    return (validators as Array<{ address: string }>).find(
      (v) => v.address.toLowerCase() === address.toLowerCase()
    ) ?? null
  },
}))

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
      <Routes>
        <Route path="/validators/:address" element={<ValidatorDetailPage />} />
      </Routes>
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
    vi.mocked(mod.useValidators).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof mod.useValidators>)

    renderWithRoute("0x0000000000000000000000000000000000000001")

    expect(screen.getByText("Validator not found.")).toBeInTheDocument()

    // Restore
    vi.mocked(mod.useValidators).mockReturnValue({
      data: [...MOCK_VALIDATORS],
      isLoading: false,
    } as unknown as ReturnType<typeof mod.useValidators>)
  })
})
