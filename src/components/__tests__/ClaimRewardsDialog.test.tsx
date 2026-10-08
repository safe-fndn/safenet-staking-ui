import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaimRewardsDialog } from "../dashboard/ClaimRewardsDialog"
import { TEST_ACCOUNTS, MOCK_TX_HASH } from "@/__tests__/test-data"

// --- Mock all hooks used by ClaimRewardsDialog ---

const mockClaimRewards = vi.fn()
const mockReset = vi.fn()
const mockToast = vi.fn()

const CLAIMABLE = 100n * 10n ** 18n
const MERKLE_ROOT = "0x" + "1".repeat(64)
const MERKLE_PROOF = ["0x" + "2".repeat(64)]

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: TEST_ACCOUNTS.user }),
}))

const mockProof = {
  cumulativeAmount: "100000000000000000000",
  merkleRoot: MERKLE_ROOT,
  proof: MERKLE_PROOF as string[] | null,
}

vi.mock("@/hooks/useRewardProof", () => ({
  useRewardProof: vi.fn(() => ({ data: mockProof })),
}))

const mockRewards = {
  claimable: CLAIMABLE,
  totalClaimed: 0n,
  canClaim: true,
  rootStale: false,
}

vi.mock("@/hooks/useRewards", () => ({
  useRewards: vi.fn(() => ({ data: mockRewards })),
}))

const mockUseClaimRewards = {
  claimRewards: mockClaimRewards,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  isSafeQueued: false,
  error: null as Error | null,
  reset: mockReset,
  txHash: undefined as `0x${string}` | undefined,
}

vi.mock("@/hooks/useClaimRewards", () => ({
  useClaimRewards: vi.fn(() => mockUseClaimRewards),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

describe("ClaimRewardsDialog", () => {
  const onOpenChange = vi.fn()

  function renderDialog() {
    const ui = () => <ClaimRewardsDialog open onOpenChange={onOpenChange} />
    const result = render(ui())
    return { ...result, rerender: () => result.rerender(ui()) }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockProof, {
      cumulativeAmount: "100000000000000000000",
      merkleRoot: MERKLE_ROOT,
      proof: MERKLE_PROOF,
    })
    Object.assign(mockRewards, {
      claimable: CLAIMABLE,
      totalClaimed: 0n,
      canClaim: true,
      rootStale: false,
    })
    Object.assign(mockUseClaimRewards, {
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
    })
  })

  it("claims with the proof args", async () => {
    const user = userEvent.setup()
    renderDialog()

    expect(screen.getByText("100")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))

    expect(mockClaimRewards).toHaveBeenCalledWith(TEST_ACCOUNTS.user, CLAIMABLE, MERKLE_ROOT, MERKLE_PROOF)
  })

  it("shows the claimed amount in the success toast and closes", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    // The cumulativeClaimed poll lands before the receipt resolves.
    Object.assign(mockRewards, { claimable: 0n, canClaim: false })
    mockUseClaimRewards.isSuccess = true
    mockUseClaimRewards.txHash = MOCK_TX_HASH
    rerender()

    expect(mockToast).toHaveBeenCalledWith({
      variant: "success",
      title: "Rewards claimed",
      description: "Claimed 100 SAFE",
      txHash: MOCK_TX_HASH,
    })
    expect(mockReset).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows the Safe queued toast and closes", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.isSafeQueued = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith({
      variant: "success",
      title: "Transaction queued in Safe",
      description: "Your claim has been sent to Safe Wallet for signing.",
    })
    expect(mockReset).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows the error toast and keeps the dialog open", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog()

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.error = new Error("User rejected the request.")
    rerender()

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error", title: "Claim failed" }))
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  it("disables the claim button when the proof has no Merkle proof", () => {
    mockProof.proof = null

    renderDialog()

    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })
})
