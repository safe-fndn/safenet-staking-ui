import { test, expect } from "../fixtures/base.fixture"
import { REWARD_PROOFS, VALIDATORS, AMOUNTS } from "../fixtures/test-data"

test.describe("Claim + Stake", () => {
  test("preselects the validator with the largest active stake for a connected EOA", async ({ connectedPage: page, mockChainState }) => {
    // Default mockChainState has Validator A at 300 SAFE, Validator B at 200 SAFE.
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")

    await expect(page.getByText("Your Rewards")).toBeVisible({ timeout: 15_000 })
    // Wait for the positions table to finish loading before opening the dialog,
    // so the largest-active-stake preselection has resolved.
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "Claim + Stake" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByRole("heading", { name: "Claim + Stake" })).toBeVisible()

    await expect(dialog.getByLabel("Validator")).toHaveValue(/^0x/i)
    const selectedLabel = await dialog.getByLabel("Validator").locator("option:checked").textContent()
    expect(selectedLabel).toBe("Validator A")

    await expect(dialog.getByRole("button", { name: "Claim Rewards" })).toBeEnabled()
  })

  test("requires an explicit validator selection when there is no active stake", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.stakes.clear()
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")

    await expect(page.getByText("Your Rewards")).toBeVisible({ timeout: 15_000 })
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

    await page.goto("/")

    await expect(page.getByText("Your Rewards")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "Claim + Stake" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText(/Step 1 of/)).toBeVisible()

    await dialog.getByRole("button", { name: "Claim Rewards" }).click()

    // Claim confirms (mock provider always succeeds), sequential flow advances to Stake.
    await expect(dialog.getByRole("button", { name: "Stake" })).toBeVisible({ timeout: 10_000 })
    await dialog.getByRole("button", { name: "Stake" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 })

    // Verify the actual on-chain state mutated, not just that a success toast appeared.
    expect(mockChainState.merkleDropClaimed).toBe(BigInt(REWARD_PROOFS.claimable.cumulativeAmount))
    expect(mockChainState.stakes.get(VALIDATORS.validatorA.toLowerCase())).toBe(
      AMOUNTS.userStakeValidatorA + BigInt(REWARD_PROOFS.claimable.cumulativeAmount),
    )
  })

  test("submits claim + stake as a single atomic batch when the wallet supports it", async ({ batchingPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")

    await expect(page.getByText("Your Rewards")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
    await page.getByRole("button", { name: "Claim + Stake" }).click()

    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("One transaction (batched)")).toBeVisible()

    await dialog.getByRole("button", { name: "Claim + Stake" }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10_000 })

    // Verify the actual on-chain state mutated, not just that a success toast appeared.
    expect(mockChainState.merkleDropClaimed).toBe(BigInt(REWARD_PROOFS.claimable.cumulativeAmount))
    expect(mockChainState.stakes.get(VALIDATORS.validatorA.toLowerCase())).toBe(
      AMOUNTS.userStakeValidatorA + BigInt(REWARD_PROOFS.claimable.cumulativeAmount),
    )
  })
})
