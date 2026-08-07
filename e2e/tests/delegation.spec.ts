import { test, expect } from "../fixtures/base.fixture"
import { AMOUNTS } from "../fixtures/test-data"

test.describe("Delegation Dialog", () => {
  test("opens delegate dialog from validator card", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")

    // Wait for Validator A card to appear
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    // Click Stake on the first validator card
    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    // Dialog should open
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
  })

  test("dialog shows amount input with balance", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    // Amount input
    await expect(page.getByLabel("Amount")).toBeVisible()
    // Balance display
    await expect(page.getByText(/SAFE Balance:/)).toBeVisible({ timeout: 10_000 })
  })

  test("dialog shows percentage buttons", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    await expect(page.getByRole("button", { name: "25%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "50%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "75%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "MAX" })).toBeVisible()
  })

  test("percentage buttons fill amount input", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    const input = page.getByLabel("Amount")

    // Click 25%
    await page.getByRole("button", { name: "25%" }).click()
    const value = await input.inputValue()
    expect(value).not.toBe("")
    expect(parseFloat(value)).toBeGreaterThan(0)
  })

  test("delegate button is disabled without amount", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    // The "Stake" button inside the dialog should be disabled
    const dialogStake = page.locator("[role='dialog']").getByRole("button", { name: "Stake" })
    await expect(dialogStake).toBeDisabled()
  })

  test("shows unstaking period info", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    // Should show unstaking period
    await expect(page.getByText(/Unstaking period/)).toBeVisible({ timeout: 10_000 })
  })

  test("dialog can be closed", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await stakeButtons.first().click()

    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()

    // Close with Escape
    await page.keyboard.press("Escape")

    await expect(page.getByRole("heading", { name: "Stake SAFE" })).not.toBeVisible()
  })

  test("approve then stake happy path updates Your Stake", async ({ connectedPage: page, mockChainState }) => {
    // Force the approval step to show by starting from zero allowance
    mockChainState.allowance = 0n

    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    // Validator A renders first
    await page.getByRole("button", { name: "Stake" }).first().click()

    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
    await page.getByLabel("Amount").fill("10")

    const approveButton = page.getByRole("button", { name: "Approve exact amount" })
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    await expect(page.getByText("Approval confirmed")).toBeVisible({ timeout: 10_000 })
    // Confirms the actual approve() call was decoded correctly, not just that a toast appeared
    expect(mockChainState.allowance).toBe(10n * 10n ** 18n)

    const dialogStake = page.locator("[role='dialog']").getByRole("button", { name: "Stake" })
    await expect(dialogStake).toBeEnabled({ timeout: 10_000 })
    await dialogStake.click()

    await expect(page.getByText("Staking successful")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).not.toBeVisible()

    // Validator A's stake was 300 SAFE; +10 staked → 310
    await expect(page.getByText("310", { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test("approve unlimited then stake happy path updates Your Stake", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.allowance = 0n

    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: "Stake" }).first().click()
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
    await page.getByLabel("Amount").fill("15")

    const approveButton = page.getByRole("button", { name: "Approve unlimited" })
    await expect(approveButton).toBeVisible()
    await approveButton.click()

    await expect(page.getByText("Approval confirmed")).toBeVisible({ timeout: 10_000 })
    // Confirms the actual approve() call was decoded correctly, not just that a toast appeared
    expect(mockChainState.allowance).toBe(AMOUNTS.unlimitedAllowance)

    const dialogStake = page.locator("[role='dialog']").getByRole("button", { name: "Stake" })
    await expect(dialogStake).toBeEnabled({ timeout: 10_000 })
    await dialogStake.click()

    await expect(page.getByText("Staking successful")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).not.toBeVisible()

    // Validator A's stake was 300 SAFE; +15 staked → 315
    await expect(page.getByText("315", { exact: true })).toBeVisible({ timeout: 10_000 })
  })

  test("rejecting the wallet prompt shows an error and leaves the dialog open", async ({ connectedPage: page, mockChainState }) => {
    mockChainState.rejectNextTx = true

    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: "Stake" }).first().click()
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
    await page.getByLabel("Amount").fill("10")

    const dialogStake = page.locator("[role='dialog']").getByRole("button", { name: "Stake" })
    await dialogStake.click()

    await expect(page.getByText("Staking failed")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Transaction rejected")).toBeVisible()
    // The dialog is left open so the user can retry, not silently closed on failure
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
  })

  test("batched approve+stake (EIP-5792) happy path updates Your Stake", async ({ batchingPage: page, mockChainState }) => {
    mockChainState.allowance = 0n

    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })

    await page.getByRole("button", { name: "Stake" }).first().click()
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).toBeVisible()
    await page.getByLabel("Amount").fill("10")

    // With batching support, there's a single "Stake" button — no separate approve step
    await expect(page.getByRole("button", { name: "Approve exact amount" })).not.toBeVisible()
    const dialogStake = page.locator("[role='dialog']").getByRole("button", { name: "Stake" })
    await dialogStake.click()

    await expect(page.getByText("Delegation successful")).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole("heading", { name: "Stake SAFE" })).not.toBeVisible()

    // Validator A's stake was 300 SAFE; +10 staked → 310
    await expect(page.getByText("310", { exact: true })).toBeVisible({ timeout: 10_000 })
  })
})
