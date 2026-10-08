import type { ComponentProps } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClaimAndStakeDialog } from "../dashboard/ClaimAndStakeDialog"
import { TEST_ACCOUNTS, MOCK_VALIDATORS, AMOUNTS } from "@/__tests__/test-data"
import type { ValidatorInfo } from "@/hooks/useValidators"
import { useApprovalFlow } from "@/hooks/useApprovalFlow"
import { useGasEstimate } from "@/hooks/useGasEstimate"
import { useInvalidateOnSuccess } from "@/hooks/useStakingWrites"

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

const CLAIMABLE = 100n * 10n ** 18n
/** Claimable after a new rewards epoch lands mid-flow. */
const NEW_EPOCH_CLAIMABLE = 150n * 10n ** 18n
const REFRESH_FN_NAMES = ["allowance", "balanceOf"]

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: TEST_ACCOUNTS.user }),
}))

let mockValidators: ValidatorInfo[] = [...MOCK_VALIDATORS]

vi.mock("@/hooks/useValidators", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useValidators")>()
  return {
    ...actual,
    useValidators: vi.fn(() => ({ data: mockValidators })),
  }
})

const MERKLE_ROOT = "0x" + "1".repeat(64)
const MERKLE_PROOF = ["0x" + "2".repeat(64)]

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

const mockApprovalFlow = {
  allowance: AMOUNTS.unlimitedAllowance as bigint | undefined,
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
  useInvalidateOnSuccess: vi.fn(),
}))

vi.mock("@/hooks/useToast", () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}))

const mockGasEstimate = { estimatedCost: null as string | null, isLoading: false }

vi.mock("@/hooks/useGasEstimate", () => ({
  useGasEstimate: vi.fn(() => mockGasEstimate),
}))

describe("ClaimAndStakeDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
  }

  // Renders the dialog and returns a rerender that keeps the current props (merging any
  // overrides), so tests can change the mocked hook state between renders.
  function renderDialog(initialProps: Partial<ComponentProps<typeof ClaimAndStakeDialog>> = {}) {
    let props = initialProps
    const ui = () => <ClaimAndStakeDialog {...defaultProps} {...props} />
    const result = render(ui())
    const rerender = (next: Partial<ComponentProps<typeof ClaimAndStakeDialog>> = {}) => {
      props = { ...props, ...next }
      result.rerender(ui())
    }
    return { ...result, rerender }
  }

  function actionItems() {
    return screen.getAllByRole("listitem").map((li) => li.textContent)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockValidators = [...MOCK_VALIDATORS]
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
    Object.assign(mockApprovalFlow, {
      allowance: AMOUNTS.unlimitedAllowance,
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
    Object.assign(mockGasEstimate, { estimatedCost: null, isLoading: false })
  })

  it("renders dialog with title and claimable amount", () => {
    renderDialog()

    expect(screen.getByText("Claim + Stake")).toBeInTheDocument()
    expect(screen.getByText("Claimable SAFE")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("preselects the validator passed as defaultValidator", () => {
    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator1)
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  it("requires explicit selection when there is no active stake", () => {
    renderDialog()

    expect(screen.getByLabelText("Validator")).toHaveValue("")
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  it("enables confirm once a validator is manually selected", async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.selectOptions(screen.getByLabelText("Validator"), TEST_ACCOUNTS.validator1)

    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  it("lists only active validators", () => {
    mockValidators = [MOCK_VALIDATORS[0], { ...MOCK_VALIDATORS[1], isActive: false }]

    renderDialog()

    const select = screen.getByLabelText("Validator")
    expect(within(select).getByRole("option", { name: "Gnosis" })).toBeInTheDocument()
    expect(within(select).queryByRole("option", { name: "Greenfield" })).not.toBeInTheDocument()
  })

  it("keeps confirm disabled until the allowance is known", () => {
    mockApprovalFlow.allowance = undefined

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  it("calls claimRewards on confirm in the sequential flow", async () => {
    const user = userEvent.setup()
    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))

    expect(mockClaimRewards).toHaveBeenCalledWith(TEST_ACCOUNTS.user, CLAIMABLE, MERKLE_ROOT, MERKLE_PROOF)
  })

  it("shows approve buttons once claimed when approval is needed", async () => {
    mockUseClaimRewards.isSuccess = true
    mockApprovalFlow.needsApproval = true

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(await screen.findByRole("button", { name: "Approve exact amount" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Approve unlimited" })).toBeEnabled()
    expect(screen.getByLabelText("Validator")).toBeDisabled()
  })

  it("stakes the amount captured at confirm even if claimable drops to 0 before the receipt", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))

    // The cumulativeClaimed poll lands before the claim receipt resolves.
    Object.assign(mockRewards, { claimable: 0n, canClaim: false })
    rerender()
    mockUseClaimRewards.isSuccess = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Rewards claimed", description: "Claimed 100 SAFE. Continue below to stake it." }),
    )
    expect(vi.mocked(useApprovalFlow)).toHaveBeenLastCalledWith(CLAIMABLE)
    expect(screen.getByText("Claimed SAFE")).toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: "Stake" }))

    expect(mockStake).toHaveBeenCalledWith(TEST_ACCOUNTS.validator1, CLAIMABLE)
  })

  it("closes the dialog without advancing when the claim is only queued in Safe", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1, onOpenChange })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.isSafeQueued = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Transaction queued in Safe" }),
    )
    expect(mockResetClaim).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(screen.queryByRole("button", { name: "Stake" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeInTheDocument()
  })

  it("keeps the step total fixed after the approval confirms", async () => {
    mockApprovalFlow.needsApproval = true
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByText("Step 1 of 3: Claim rewards")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.isSuccess = true
    rerender()
    mockUseClaimRewards.isSuccess = false
    rerender()

    expect(screen.getByText("Step 2 of 3: Approve SAFE for staking")).toBeInTheDocument()

    // Approval confirmed: the allowance now covers the amount.
    mockApprovalFlow.needsApproval = false
    rerender()

    expect(screen.getByText("Step 3 of 3: Stake")).toBeInTheDocument()
    expect(actionItems()).toEqual([
      "1. Claim 100 SAFEDone",
      "2. Approve 100 SAFE for stakingDone",
      "3. Stake 100 SAFE to Gnosis",
    ])
  })

  it("lists claim and stake as separate transactions when no approval is needed", () => {
    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByText("2 transactions, signed one by one")).toBeInTheDocument()
    expect(actionItems()).toEqual(["1. Claim 100 SAFE", "2. Stake 100 SAFE to Gnosis"])
  })

  it("adds the approval to the transaction details when it is needed", () => {
    mockApprovalFlow.needsApproval = true

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByText("3 transactions, signed one by one")).toBeInTheDocument()
    expect(actionItems()).toEqual([
      "1. Claim 100 SAFE",
      "2. Approve 100 SAFE for staking",
      "3. Stake 100 SAFE to Gnosis",
    ])
  })

  it("falls back to the truncated address when the validator has no label", () => {
    mockValidators = [{ ...MOCK_VALIDATORS[0], label: "" }]

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(actionItems()).toContain("2. Stake 100 SAFE to 0x1234...5678")
  })

  it("marks the claim as done and explains where the claimed SAFE is", () => {
    mockUseClaimRewards.isSuccess = true

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(actionItems()[0]).toBe("1. Claim 100 SAFEDone")
    expect(screen.getByText(/now in your wallet.*Validators page/)).toBeInTheDocument()
  })

  it("keeps the Stake step available for retry after a rejected stake", async () => {
    mockUseClaimRewards.isSuccess = true
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1, onOpenChange })

    await user.click(await screen.findByRole("button", { name: "Stake" }))
    mockUseStake.error = new Error("User rejected the request.")
    rerender()

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error", title: "Staking failed" }))
    expect(screen.getByRole("button", { name: "Stake" })).toBeEnabled()
    expect(screen.getByLabelText("Validator")).toBeDisabled()
    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator1)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)

    await user.click(screen.getByRole("button", { name: "Stake" }))
    expect(mockStake).toHaveBeenCalledTimes(2)
  })

  it("only estimates stake gas once the claim is done and no approval is needed", () => {
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(vi.mocked(useGasEstimate)).toHaveBeenLastCalledWith("stake", TEST_ACCOUNTS.validator1, 0n)

    mockUseClaimRewards.isSuccess = true
    mockGasEstimate.estimatedCost = "0.0001"
    rerender()

    expect(vi.mocked(useGasEstimate)).toHaveBeenLastCalledWith("stake", TEST_ACCOUNTS.validator1, CLAIMABLE)
    expect(screen.getByText("Estimated gas: ~0.000100 ETH")).toBeInTheDocument()
  })

  it("does not estimate gas while the approval is still pending", () => {
    mockUseClaimRewards.isSuccess = true
    mockApprovalFlow.needsApproval = true

    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(vi.mocked(useGasEstimate)).toHaveBeenLastCalledWith("stake", TEST_ACCOUNTS.validator1, 0n)
  })

  it("includes the approval in the batch when it is needed", async () => {
    mockUseBatchClaimAndStake.supportsBatching = true
    mockApprovalFlow.needsApproval = true
    // Gas would be shown in the sequential flow; the batch flow never shows it.
    mockGasEstimate.estimatedCost = "0.0001"

    const user = userEvent.setup()
    renderDialog({ defaultValidator: TEST_ACCOUNTS.validator2 })

    expect(screen.getByText("One transaction (batched)")).toBeInTheDocument()
    expect(actionItems()).toEqual([
      "1. Claim 100 SAFE",
      "2. Approve 100 SAFE for staking",
      "3. Stake 100 SAFE to Greenfield",
    ])
    expect(screen.queryByText(/Step \d of/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Estimated gas/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))

    expect(mockBatchClaimAndStake).toHaveBeenCalledWith(
      TEST_ACCOUNTS.user,
      CLAIMABLE,
      MERKLE_ROOT,
      MERKLE_PROOF,
      TEST_ACCOUNTS.validator2,
      CLAIMABLE,
      true,
    )
  })

  it("uses the captured amount in the batch success toast", async () => {
    mockUseBatchClaimAndStake.supportsBatching = true
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1, onOpenChange })

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))
    Object.assign(mockRewards, { claimable: 0n, canClaim: false })
    mockUseBatchClaimAndStake.isSuccess = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Claim + stake successful", description: "Claimed and staked 100 SAFE to Gnosis" }),
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("starts a retry from live values after a rejected claim", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.error = new Error("User rejected the request.")
    rerender()

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error", title: "Claim failed" }))
    expect(screen.getByText("Step 1 of 2: Claim rewards")).toBeInTheDocument()
    expect(screen.getByLabelText("Validator")).toBeEnabled()

    // A new epoch lands before the retry, and the allowance no longer covers the larger amount.
    mockRewards.claimable = NEW_EPOCH_CLAIMABLE
    mockProof.cumulativeAmount = NEW_EPOCH_CLAIMABLE.toString()
    mockApprovalFlow.needsApproval = true
    rerender()

    expect(screen.getByText("Step 1 of 3: Claim rewards")).toBeInTheDocument()
    expect(actionItems()).toEqual([
      "1. Claim 150 SAFE",
      "2. Approve 150 SAFE for staking",
      "3. Stake 150 SAFE to Gnosis",
    ])

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    expect(mockClaimRewards).toHaveBeenLastCalledWith(TEST_ACCOUNTS.user, NEW_EPOCH_CLAIMABLE, MERKLE_ROOT, MERKLE_PROOF)

    mockUseClaimRewards.error = null
    mockUseClaimRewards.isSuccess = true
    rerender()
    mockUseClaimRewards.isSuccess = false
    mockApprovalFlow.needsApproval = false
    rerender()

    expect(screen.getByText("Step 3 of 3: Stake")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Stake" }))
    expect(mockStake).toHaveBeenCalledWith(TEST_ACCOUNTS.validator1, NEW_EPOCH_CLAIMABLE)
  })

  it("starts a batch retry from live values after the batch fails", async () => {
    mockUseBatchClaimAndStake.supportsBatching = true
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))
    mockUseBatchClaimAndStake.error = new Error("User rejected the request.")
    rerender()

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error", title: "Claim + stake failed" }))
    expect(vi.mocked(useInvalidateOnSuccess)).toHaveBeenLastCalledWith(true, REFRESH_FN_NAMES, [])

    mockRewards.claimable = NEW_EPOCH_CLAIMABLE
    mockProof.cumulativeAmount = NEW_EPOCH_CLAIMABLE.toString()
    mockApprovalFlow.needsApproval = true
    rerender()

    expect(actionItems()).toEqual([
      "1. Claim 150 SAFE",
      "2. Approve 150 SAFE for staking",
      "3. Stake 150 SAFE to Gnosis",
    ])

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))
    expect(mockBatchClaimAndStake).toHaveBeenLastCalledWith(
      TEST_ACCOUNTS.user,
      NEW_EPOCH_CLAIMABLE,
      MERKLE_ROOT,
      MERKLE_PROOF,
      TEST_ACCOUNTS.validator1,
      NEW_EPOCH_CLAIMABLE,
      true,
    )
  })

  it("shows the revert toast, resets, and re-reads the approval need after a batch reverts", async () => {
    mockUseBatchClaimAndStake.supportsBatching = true
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(vi.mocked(useInvalidateOnSuccess)).toHaveBeenLastCalledWith(false, REFRESH_FN_NAMES, [])

    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))
    expect(mockBatchClaimAndStake).toHaveBeenLastCalledWith(
      TEST_ACCOUNTS.user,
      CLAIMABLE,
      MERKLE_ROOT,
      MERKLE_PROOF,
      TEST_ACCOUNTS.validator1,
      CLAIMABLE,
      false,
    )

    mockUseBatchClaimAndStake.isReverted = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "error", title: "Transaction reverted" }))
    expect(mockResetBatch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(useInvalidateOnSuccess)).toHaveBeenCalledWith(true, REFRESH_FN_NAMES, [])

    // resetBatch cleared the revert, and the re-read allowance no longer covers the claim.
    mockUseBatchClaimAndStake.isReverted = false
    mockApprovalFlow.needsApproval = true
    rerender()

    expect(actionItems()).toContain("2. Approve 100 SAFE for staking")
    await user.click(screen.getByRole("button", { name: "Claim + Stake" }))
    expect(mockBatchClaimAndStake).toHaveBeenLastCalledWith(
      TEST_ACCOUNTS.user,
      CLAIMABLE,
      MERKLE_ROOT,
      MERKLE_PROOF,
      TEST_ACCOUNTS.validator1,
      CLAIMABLE,
      true,
    )
  })

  it("closes the dialog when the stake is only queued in Safe", async () => {
    mockUseClaimRewards.isSuccess = true
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1, onOpenChange })

    await user.click(await screen.findByRole("button", { name: "Stake" }))
    mockUseClaimRewards.isSuccess = false
    mockUseStake.isSafeQueued = true
    rerender()

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Transaction queued in Safe",
        description: "Your delegation has been sent to Safe Wallet for signing.",
      }),
    )
    expect(mockResetStake).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("starts again at step 1 after closing mid-flow and reopening", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.isSuccess = true
    rerender()
    mockUseClaimRewards.isSuccess = false
    Object.assign(mockRewards, { claimable: 0n, canClaim: false })
    rerender()
    expect(screen.getByText("Step 2 of 2: Stake")).toBeInTheDocument()

    rerender({ open: false })
    rerender({ open: true })

    expect(screen.getByText("Step 1 of 2: Claim rewards")).toBeInTheDocument()
    expect(screen.getByText("Claimable SAFE")).toBeInTheDocument()
    expect(screen.queryByText("Done")).not.toBeInTheDocument()
    expect(screen.queryByText(/now in your wallet/)).not.toBeInTheDocument()
    expect(screen.getByLabelText("Validator")).toBeEnabled()
    // Everything was claimed, so there is nothing left to confirm.
    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  it("keeps a manual pick when the parent rerenders with the same defaultValidator", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.selectOptions(screen.getByLabelText("Validator"), TEST_ACCOUNTS.validator2)
    rerender()

    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator2)
    expect(actionItems()).toContain("2. Stake 100 SAFE to Greenfield")
  })

  it("does not swap the validator after confirm when defaultValidator changes", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    // A stakes poll now makes another validator the largest position.
    rerender({ defaultValidator: TEST_ACCOUNTS.validator2 })

    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator1)

    mockUseClaimRewards.isSuccess = true
    rerender()

    expect(screen.getByLabelText("Validator")).toHaveValue(TEST_ACCOUNTS.validator1)
    expect(actionItems()).toContain("2. Stake 100 SAFE to Gnosis")
    await user.click(screen.getByRole("button", { name: "Stake" }))
    expect(mockStake).toHaveBeenCalledWith(TEST_ACCOUNTS.validator1, CLAIMABLE)
  })

  it("adds the approval step when a re-read after a failed stake shows the allowance dropped", async () => {
    const user = userEvent.setup()
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    await user.click(screen.getByRole("button", { name: "Claim Rewards" }))
    mockUseClaimRewards.isSuccess = true
    rerender()
    mockUseClaimRewards.isSuccess = false
    rerender()
    expect(screen.getByText("Step 2 of 2: Stake")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Stake" }))
    mockUseStake.error = new Error("ERC20InsufficientAllowance")
    rerender()

    expect(vi.mocked(useInvalidateOnSuccess)).toHaveBeenLastCalledWith(true, REFRESH_FN_NAMES, [])

    // The re-read shows the allowance was used up in another tab.
    mockApprovalFlow.needsApproval = true
    rerender()

    expect(screen.getByText("Step 2 of 3: Approve SAFE for staking")).toBeInTheDocument()
    expect(screen.getByText("3 transactions, signed one by one")).toBeInTheDocument()
    expect(actionItems()).toEqual([
      "1. Claim 100 SAFEDone",
      "2. Approve 100 SAFE for staking",
      "3. Stake 100 SAFE to Gnosis",
    ])
    expect(screen.getByRole("button", { name: "Approve exact amount" })).toBeEnabled()

    // Once the approval confirms, the total stays at 3.
    mockApprovalFlow.needsApproval = false
    rerender()

    expect(screen.getByText("Step 3 of 3: Stake")).toBeInTheDocument()
    expect(actionItems()[1]).toBe("2. Approve 100 SAFE for stakingDone")
  })

  it("keeps confirm disabled without a Merkle proof", () => {
    mockProof.proof = null
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    expect(screen.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()

    mockUseBatchClaimAndStake.supportsBatching = true
    rerender()

    expect(screen.getByRole("button", { name: "Claim + Stake" })).toBeDisabled()
  })

  it("resets all flows when dialog closes", () => {
    const { rerender } = renderDialog({ defaultValidator: TEST_ACCOUNTS.validator1 })

    rerender({ open: false })

    expect(mockResetApprovalFlow).toHaveBeenCalled()
    expect(mockResetClaim).toHaveBeenCalled()
    expect(mockResetStake).toHaveBeenCalled()
    expect(mockResetBatch).toHaveBeenCalled()
  })
})
