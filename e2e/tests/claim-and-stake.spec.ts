import type { Page } from "@playwright/test"
import { test, expect, MOCK_VALIDATORS } from "../fixtures/base.fixture"
import {
  REWARD_PROOFS,
  VALIDATORS,
  AMOUNTS,
  MERKLE_DROP_CONTRACT,
  STAKING_CONTRACT,
  TOKEN_CONTRACT,
} from "../fixtures/test-data"
import { TX_SELECTORS, type MockCall, type MockChainState } from "../mocks/mock-chain-state"

/** REWARD_PROOFS.claimable with nothing claimed yet: 100 SAFE. The dialog shows it as "100". */
const CLAIMABLE = BigInt(REWARD_PROOFS.claimable.cumulativeAmount)

function stakeOn(state: MockChainState, validator: string): bigint | undefined {
  return state.stakes.get(validator.toLowerCase())
}

/** The target contract and 4-byte selector of each call in a batch, for order checks. */
function describeBatch(batch: MockCall[]): { to: string; selector: string }[] {
  return batch.map((call) => ({ to: call.to.toLowerCase(), selector: call.data.slice(0, 10).toLowerCase() }))
}

/**
 * Open the dashboard, wait for the positions table (so the largest-stake preselection
 * has resolved), then open the Claim + Stake dialog and return it.
 */
async function openClaimAndStake(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Claim + Stake" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("heading", { name: "Claim + Stake" })).toBeVisible()
  return dialog
}

test.describe("Claim + Stake", () => {
  test("preselects the validator with the largest active stake for a connected EOA", async ({ connectedPage: page, mockChainState }) => {
    // Default mockChainState has Validator A at 300 SAFE, Validator B at 200 SAFE.
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)

    await expect(dialog.getByLabel("Validator").locator("option:checked")).toHaveText("Validator A")

    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  test("requires an explicit validator selection when there is no active stake", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.stakes.clear()
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")

    // Wait for the empty-positions state so the dialog opens only once stake data has resolved.
    await expect(page.getByText(/You have no active stakes/)).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "Claim + Stake" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByLabel("Validator")).toHaveValue("")
    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()

    await dialog.getByLabel("Validator").selectOption({ label: "Validator A" })
    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  test("guides the user through claim then stake sequentially when batching is unavailable", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await expect(dialog.getByText(/Step 1 of/)).toBeVisible()

    await dialog.getByRole("button", { name: "Claim Rewards" }).click()

    // Claim confirms (mock provider always succeeds), sequential flow advances to Stake.
    await expect(dialog.getByRole("button", { name: "Stake" })).toBeVisible({ timeout: 10_000 })
    await dialog.getByRole("button", { name: "Stake" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 })

    // Verify the actual on-chain state mutated, not just that a success toast appeared.
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
  })

  test("sequential flow with approval: claim, approve exact amount, then stake", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.allowance = 0n
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    const steps = dialog.getByRole("listitem")
    const claimStep = steps.filter({ hasText: "Claim 100 SAFE" })
    const approveStep = steps.filter({ hasText: "Approve 100 SAFE for staking" })
    const stakeStep = steps.filter({ hasText: "Stake 100 SAFE to Validator A" })

    await expect(dialog.getByText("Step 1 of 3: Claim rewards")).toBeVisible()
    await expect(dialog.getByText("3 transactions, signed one by one")).toBeVisible()
    await expect(steps).toHaveText([
      "1. Claim 100 SAFE",
      "2. Approve 100 SAFE for staking",
      "3. Stake 100 SAFE to Validator A",
    ])

    // Step 1: claim
    await dialog.getByRole("button", { name: "Claim Rewards" }).click()
    await expect(page.getByText("Rewards claimed")).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText("Step 2 of 3: Approve SAFE for staking")).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText("Claimed SAFE", { exact: true })).toBeVisible()
    await expect(dialog.getByText("The claimed SAFE is now in your wallet.")).toBeVisible()
    await expect(claimStep).toContainText("Done")
    await expect(approveStep).not.toContainText("Done")
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)
    expect(mockChainState.balance).toBe(AMOUNTS.userBalance + CLAIMABLE)

    // Step 2: approve exactly the claimed amount
    await dialog.getByRole("button", { name: "Approve exact amount" }).click()
    await expect(page.getByText("Approval confirmed")).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByText("Step 3 of 3: Stake")).toBeVisible({ timeout: 10_000 })
    await expect(claimStep).toContainText("Done")
    await expect(approveStep).toContainText("Done")
    await expect(stakeStep).not.toContainText("Done")
    expect(mockChainState.allowance).toBe(CLAIMABLE)

    // Step 3: stake
    await dialog.getByRole("button", { name: "Stake", exact: true }).click()
    await expect(page.getByText("Claim + stake successful")).toBeVisible({ timeout: 10_000 })
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
    expect(stakeOn(mockChainState, VALIDATORS.validatorB)).toBe(AMOUNTS.userStakeValidatorB)
    // The claimed SAFE went straight into the stake.
    expect(mockChainState.balance).toBe(AMOUNTS.userBalance)
    expect(mockChainState.batches).toHaveLength(0)
  })

  test("batch flow with approval submits claim, approve and stake in one batch", async ({ batchingPage: page, mockChainState }) => {
    mockChainState.allowance = 0n
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await expect(dialog.getByText("One transaction (batched)")).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByRole("listitem")).toHaveText([
      "1. Claim 100 SAFE",
      "2. Approve 100 SAFE for staking",
      "3. Stake 100 SAFE to Validator A",
    ])

    await dialog.getByRole("button", { name: "Claim + Stake" }).click()
    await expect(page.getByText("Claim + stake successful")).toBeVisible({ timeout: 10_000 })
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    expect(mockChainState.batches).toHaveLength(1)
    expect(describeBatch(mockChainState.batches[0])).toEqual([
      { to: MERKLE_DROP_CONTRACT, selector: TX_SELECTORS.claim },
      { to: TOKEN_CONTRACT, selector: TX_SELECTORS.approve },
      { to: STAKING_CONTRACT, selector: TX_SELECTORS.stake },
    ])
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)
    // The batch approves exactly the claimed amount, not an unlimited allowance.
    expect(mockChainState.allowance).toBe(CLAIMABLE)
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
    expect(mockChainState.balance).toBe(AMOUNTS.userBalance)
  })

  test("batch flow without approval submits only claim and stake", async ({ batchingPage: page, mockChainState }) => {
    // Default allowance is unlimited, so no approve call is needed.
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await expect(dialog.getByText("One transaction (batched)")).toBeVisible({ timeout: 10_000 })
    await expect(dialog.getByRole("listitem")).toHaveText([
      "1. Claim 100 SAFE",
      "2. Stake 100 SAFE to Validator A",
    ])

    await dialog.getByRole("button", { name: "Claim + Stake" }).click()
    await expect(page.getByText("Claim + stake successful")).toBeVisible({ timeout: 10_000 })
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })

    expect(mockChainState.batches).toHaveLength(1)
    expect(describeBatch(mockChainState.batches[0])).toEqual([
      { to: MERKLE_DROP_CONTRACT, selector: TX_SELECTORS.claim },
      { to: STAKING_CONTRACT, selector: TX_SELECTORS.stake },
    ])
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)
    expect(mockChainState.allowance).toBe(AMOUNTS.unlimitedAllowance)
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
  })

  test("preselects the largest active stake even when it is not the first validator", async ({ connectedPage: page, mockChainState }) => {
    // Validator A (listed first) keeps 300 SAFE, Validator B gets the larger 400 SAFE.
    mockChainState.stakes.set(VALIDATORS.validatorB.toLowerCase(), 400n * 10n ** 18n)
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    const select = dialog.getByLabel("Validator")

    await expect(select).toHaveValue(new RegExp(`^${VALIDATORS.validatorB}$`, "i"))
    await expect(select.locator("option:checked")).toHaveText("Validator B")
    await expect(dialog.getByText("Stake 100 SAFE to Validator B")).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  test("does not list inactive validators and skips them for the preselection", async ({ connectedPage: page, mockChainState }) => {
    // Validator B is inactive but holds the largest stake (400 SAFE vs 300 SAFE on A).
    // Registered after the fixture's route, so Playwright runs this handler first.
    await page.route("**/mock-validators.test/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          MOCK_VALIDATORS.map((v) => (v.address === VALIDATORS.validatorB ? { ...v, is_active: false } : v)),
        ),
      })
    })
    mockChainState.stakes.set(VALIDATORS.validatorB.toLowerCase(), 400n * 10n ** 18n)
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")
    // The inactive position still shows in the positions table.
    const inactiveRow = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Validator B" }) })
    await expect(inactiveRow.getByText("Inactive")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible()
    await page.getByRole("button", { name: "Claim + Stake" }).click()

    const dialog = page.getByRole("dialog")
    const select = dialog.getByLabel("Validator")
    await expect(select.locator("option")).toHaveText(["Select a validator", "Validator A"])
    await expect(select).toHaveValue(new RegExp(`^${VALIDATORS.validatorA}$`, "i"))
    await expect(select.locator("option:checked")).toHaveText("Validator A")
    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  test("rejecting the claim shows an error, keeps the dialog on step 1 and a retry succeeds", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await expect(dialog.getByText("Step 1 of 2: Claim rewards")).toBeVisible()

    mockChainState.rejectNextTx = true
    await dialog.getByRole("button", { name: "Claim Rewards" }).click()

    await expect(page.getByText("Claim failed", { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Transaction rejected")).toBeVisible()
    await expect(dialog.getByText("Step 1 of 2: Claim rewards")).toBeVisible()
    await expect(dialog.getByText("Claimable SAFE", { exact: true })).toBeVisible()
    await expect(dialog.getByText("Done", { exact: true })).toHaveCount(0)
    // Left usable for a retry, not stuck spinning.
    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
    await expect(dialog.getByLabel("Validator")).toBeEnabled()

    expect(mockChainState.merkleDropClaimed).toBe(0n)
    expect(mockChainState.balance).toBe(AMOUNTS.userBalance)
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA)

    // The failed attempt clears the captured values, so the retry must still claim and stake the full amount.
    await dialog.getByRole("button", { name: "Claim Rewards" }).click()
    await expect(dialog.getByText("Step 2 of 2: Stake")).toBeVisible({ timeout: 10_000 })
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)

    await dialog.getByRole("button", { name: "Stake", exact: true }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 })
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
  })

  test("rejecting the stake after a successful claim keeps the Stake step and a retry succeeds", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await dialog.getByRole("button", { name: "Claim Rewards" }).click()
    await expect(dialog.getByText("Step 2 of 2: Stake")).toBeVisible({ timeout: 10_000 })
    expect(mockChainState.merkleDropClaimed).toBe(CLAIMABLE)

    const stakeButton = dialog.getByRole("button", { name: "Stake", exact: true })
    mockChainState.rejectNextTx = true
    await stakeButton.click()

    await expect(page.getByText("Staking failed", { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Transaction rejected")).toBeVisible()
    await expect(dialog.getByText("Step 2 of 2: Stake")).toBeVisible()
    await expect(dialog.getByText("Claimed SAFE", { exact: true })).toBeVisible()
    // The claim already went through, so the validator can no longer change.
    await expect(dialog.getByLabel("Validator")).toBeDisabled()
    await expect(stakeButton).toBeEnabled()
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA)

    // Retry
    await stakeButton.click()
    await expect(page.getByText("Claim + stake successful")).toBeVisible({ timeout: 10_000 })
    await expect(dialog).not.toBeVisible({ timeout: 10_000 })
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA + CLAIMABLE)
  })

  test("rejecting the batch shows an error and leaves the dialog open with nothing claimed", async ({ batchingPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    const dialog = await openClaimAndStake(page)
    await expect(dialog.getByText("One transaction (batched)")).toBeVisible({ timeout: 10_000 })

    mockChainState.rejectNextTx = true
    await dialog.getByRole("button", { name: "Claim + Stake" }).click()

    await expect(page.getByText("Claim + stake failed", { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Transaction rejected")).toBeVisible()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("button", { name: "Claim + Stake" })).toBeEnabled()

    expect(mockChainState.batches).toHaveLength(0)
    expect(mockChainState.merkleDropClaimed).toBe(0n)
    expect(mockChainState.balance).toBe(AMOUNTS.userBalance)
    expect(stakeOn(mockChainState, VALIDATORS.validatorA)).toBe(AMOUNTS.userStakeValidatorA)
  })

  test.describe("trigger button", () => {
    test("is disabled when the address has no reward proof", async ({ connectedPage: page }) => {
      // Default mockChainState.rewardProof is undefined, so the proof endpoint answers 404.
      const proofResponse = page.waitForResponse("**/mock-rewards.test/**")
      await page.goto("/")
      expect((await proofResponse).status()).toBe(404)

      await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole("button", { name: "Claim + Stake" })).toBeDisabled()
    })

    test("is disabled when rewards are fully claimed", async ({ connectedPage: page, mockChainState }) => {
      mockChainState.rewardProof = REWARD_PROOFS.fullyClaimed
      mockChainState.merkleDropClaimed = BigInt(REWARD_PROOFS.fullyClaimed.cumulativeAmount)

      await page.goto("/")

      // Proof and claimed amount have both loaded once the total shows.
      await expect(page.getByText("Total claimed: 50 SAFE")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole("button", { name: "Claim + Stake" })).toBeDisabled()
    })

    test("is disabled when the onchain root is stale", async ({ connectedPage: page, mockChainState }) => {
      mockChainState.rewardProof = REWARD_PROOFS.staleRoot

      await page.goto("/")

      // The claimable amount (100 SAFE) still shows, but claiming waits for a matching proof.
      const row = page.getByText("Claimable SAFE").locator("..")
      await expect(row.getByText("100", { exact: true })).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole("button", { name: "Claim + Stake" })).toBeDisabled()
    })
  })
})
