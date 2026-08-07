import { test, expect } from "../fixtures/base.fixture"
import { REWARD_PROOFS } from "../fixtures/test-data"
import type { Page } from "@playwright/test"

/** The "Claimable SAFE" label and amount live in the same container as the Claim Rewards trigger. */
function rewardsRow(page: Page) {
  return page.getByText("Claimable SAFE").locator("..")
}

test.describe("Rewards", () => {
  test("claim button disabled when the address has no reward proof", async ({ connectedPage: page }) => {
    // Default mockChainState.rewardProof is undefined -> proof endpoint 404s
    await page.goto("/")

    const row = rewardsRow(page)
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText("0", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  test("claim button disabled when rewards are fully claimed", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.fullyClaimed
    mockChainState.merkleDropClaimed = BigInt(REWARD_PROOFS.fullyClaimed.cumulativeAmount)

    await page.goto("/")

    const row = rewardsRow(page)
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText("0", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  test("claim button disabled when the on-chain root is stale", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.staleRoot

    await page.goto("/")

    // Claimable amount is still shown (100 SAFE) but claiming is blocked until the proof catches up
    const row = rewardsRow(page)
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText("100", { exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  test("claim happy path resets claimable to zero", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.claimable

    await page.goto("/")

    const row = rewardsRow(page)
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText("100", { exact: true })).toBeVisible({ timeout: 10_000 })

    const claimTrigger = page.getByRole("button", { name: "Claim Rewards" }).first()
    await expect(claimTrigger).toBeEnabled()
    await claimTrigger.click()

    const dialogClaimButton = page.locator("[role='dialog']").getByRole("button", { name: "Claim Rewards" })
    await expect(dialogClaimButton).toBeEnabled()
    await dialogClaimButton.click()

    await expect(page.getByText("Rewards claimed")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Claim Rewards" })).not.toBeVisible()

    // Cumulative amount (100) now fully claimed -> claimable back to 0, button disabled again
    await expect(row.getByText("0", { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("button", { name: "Claim Rewards" })).toBeDisabled()
  })

  test("shows a compliance note when part of the reward is pending KYC", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rewardProof = REWARD_PROOFS.partialKyc

    await page.goto("/")

    await expect(rewardsRow(page)).toBeVisible({ timeout: 10_000 })
    // Independent of the Claim button's enabled state — this is purely informational
    await expect(page.getByText(/pending compliance checks/)).toBeVisible({ timeout: 10_000 })
  })
})
