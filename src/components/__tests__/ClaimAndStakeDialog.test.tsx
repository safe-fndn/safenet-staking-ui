import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@radix-ui/react-tooltip"
import { ClaimAndStakeDialog } from "../dashboard/ClaimAndStakeDialog"
import { TEST_ACCOUNTS, MOCK_VALIDATORS } from "@/__tests__/test-data"

// --- Mock all hooks used by ClaimAndStakeDialog ---

const mockClaimRewards = vi.fn()
const mockResetClaim = vi.fn()
const mockStake = vi.fn()
const mockResetStake = vi.fn()
const mockBatchClaimAndStake = vi.fn()
const mockResetBatch = vi.fn()
const mockApproveExact = vi.fn()
const mockApproveUnlimited = vi.fn()
const mockResetApprovalFlow = vi.fn()
const mockToast = vi.fn()

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: TEST_ACCOUNTS.user }),
}))

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return {
    ...actual,
    useValidators: vi.fn(() => ({ data: MOCK_VALIDATORS })),
  }
})

vi.mock("@/hooks/useRewardProof", () => ({
  useRewardProof: vi.fn(() => ({
    data: {
      cumulativeAmount: "100000000000000000000",
      merkleRoot: "0x" + "1".repeat(64),
      proof: ["0x" + "2".repeat(64)],
    },
  })),
}))

const mockRewards = {
  claimable: 100n * 10n ** 18n,
  totalClaimed: 0n,
  canClaim: true,
  rootStale: false,
}

vi.mock("@/hooks/useRewards", () => ({
  useRewards: vi.fn(() => ({ data: mockRewards })),
}))

const mockApprovalFlow = {
  needsApproval: false,
  approvalType: null as "exact" | "unlimited" | null,
  isApprovalPending: false,
  isSigningApproval: false,
  isConfirmingApproval: false,
  approveExact: mockApproveExact,
  approveUnlimited: mockApproveUnlimited,
  resetApprovalFlow: mockResetApprovalFlow,
}

vi.mock("@/hooks/useApprovalFlow", () => ({
  useApprovalFlow: vi.fn(() => mockApprovalFlow),
}))

const mockUseClaimRewards = {
  claimRewards: mockClaimRewards,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  isSafeQueued: false,
  error: null as Error | null,
  reset: mockResetClaim,
  txHash: undefined as `0x${string}` | undefined,
}

vi.mock("@/hooks/useClaimRewards", () => ({
  useClaimRewards: vi.fn(() => mockUseClaimRewards),
}))

const mockUseStake = {
  stake: mockStake,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  isSafeQueued: false,
  error: null as Error | null,
  reset: mockResetStake,
  txHash: undefined as `0x${string}` | undefined,
}

const mockUseBatchClaimAndStake = {
  batchClaimAndStake: mockBatchClaimAndStake,
  supportsBatching: false,
  isSigningTx: false,
  isConfirmingTx: false,
  isSuccess: false,
  isReverted: false,
  error: null as Error | null,
  reset: mockResetBatch,
  txHash: undefined as `0x${string}` | undefined,
}

vi.mock("@/hooks/useStakingWrites", () => ({
  useStake: vi.fn(() => mockUseStake),
  useBatchClaimAndStake: vi.fn(() => mockUseBatchClaimAndStake),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

describe("ClaimAndStakeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockApprovalFlow, {
      needsApproval: false,
      approvalType: null,
      isApprovalPending: false,
      isSigningApproval: false,
      isConfirmingApproval: false,
    })
    Object.assign(mockUseClaimRewards, {
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
    })
    Object.assign(mockUseStake, {
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isSafeQueued: false,
      error: null,
      txHash: undefined,
    })
    Object.assign(mockUseBatchClaimAndStake, {
      supportsBatching: false,
      isSigningTx: false,
      isConfirmingTx: false,
      isSuccess: false,
      isReverted: false,
      error: null,
      txHash: undefined,
    })
  })

  it("renders dialog with title and claimable amount", () => {
    render(<TooltipProvider><ClaimAndStakeDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByText("Claim + Stake")).toBeInTheDocument()
    expect(screen.getByText("Claimable SAFE")).toBeInTheDocument()
  })

  it("preselects the validator passed as defaultValidator", () => {
    render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator1)
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  it("requires explicit selection when there is no active stake", () => {
    render(<TooltipProvider><ClaimAndStakeDialog {...defaultProps} /></TooltipProvider>)

    expect(screen.getByLabelText("Validator")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  it("enables confirm once a validator is manually selected", async () => {
    const user = userEvent.setup()
    render(<TooltipProvider><ClaimAndStakeDialog {...defaultProps} /></TooltipProvider>)

    await user.selectOptions(screen.getByLabelText("Validator"), TEST_ACCOUNTS.validator1)

    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  it("calls claimRewards on confirm in the sequential flow", async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))

    expect(mockClaimRewards).toHaveBeenCalledWith(
      TEST_ACCOUNTS.user,
      100n * 10n ** 18n,
      "0x" + "1".repeat(64),
      ["0x" + "2".repeat(64)],
    )
  })

  it("shows Stake button once claimed and no approval is needed", async () => {
    mockUseClaimRewards.isSuccess = true

    render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    expect(await screen.findByRole("button", { name: "Stake" })).toBeInTheDocument()
  })

  it("shows approve buttons once claimed when approval is needed", async () => {
    mockUseClaimRewards.isSuccess = true
    mockApprovalFlow.needsApproval = true

    render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    expect(await screen.findByRole("button", { name: "Approve exact amount" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Approve unlimited" })).toBeInTheDocument()
  })

  it("uses the batch flow when supportsBatching is true", async () => {
    mockUseBatchClaimAndStake.supportsBatching = true

    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))

    expect(mockBatchClaimAndStake).toHaveBeenCalledWith(
      TEST_ACCOUNTS.user,
      100n * 10n ** 18n,
      "0x" + "1".repeat(64),
      ["0x" + "2".repeat(64)],
      TEST_ACCOUNTS.validator1,
      100n * 10n ** 18n,
      false,
    )
  })

  it("resets all flows when dialog closes", () => {
    const { rerender } = render(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    rerender(
      <TooltipProvider>
        <ClaimAndStakeDialog {...defaultProps} open={false} defaultValidator={TEST_ACCOUNTS.validator1} />
      </TooltipProvider>,
    )

    expect(mockResetApprovalFlow).toHaveBeenCalled()
    expect(mockResetClaim).toHaveBeenCalled()
    expect(mockResetStake).toHaveBeenCalled()
    expect(mockResetBatch).toHaveBeenCalled()
  })
})
