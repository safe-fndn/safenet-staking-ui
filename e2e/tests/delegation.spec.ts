import { test, expect } from "../fixtures/base.fixture"

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
})
