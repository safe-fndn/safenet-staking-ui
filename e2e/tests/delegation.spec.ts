import { test, expect } from "../fixtures/base.fixture"
import { VALIDATORS } from "../fixtures/test-data"

test.describe("Delegation Dialog", () => {
  test("opens delegate dialog from validator card", async ({ connectedPage: page }) => {
    await page.goto("/validators")

    // Wait for Gnosis card to appear
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Click Delegate on the first validator card
    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    // Dialog should open
    await expect(page.getByRole("heading", { name: "Delegate SAFE" })).toBeVisible()
  })

  test("dialog shows amount input with balance", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    // Amount input
    await expect(page.getByLabel("Amount")).toBeVisible()
    // Balance display
    await expect(page.getByText(/Balance:.*SAFE/)).toBeVisible()
  })

  test("dialog shows percentage buttons", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    await expect(page.getByRole("button", { name: "25%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "50%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "75%" })).toBeVisible()
    await expect(page.getByRole("button", { name: "MAX" })).toBeVisible()
  })

  test("percentage buttons fill amount input", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    const input = page.getByLabel("Amount")

    // Click 25%
    await page.getByRole("button", { name: "25%" }).click()
    const value = await input.inputValue()
    expect(value).not.toBe("")
    expect(parseFloat(value)).toBeGreaterThan(0)
  })

  test("delegate button is disabled without amount", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    // The "Delegate" button inside the dialog should be disabled
    const dialogDelegate = page.locator("[role='dialog']").getByRole("button", { name: "Delegate" })
    await expect(dialogDelegate).toBeDisabled()
  })

  test("shows unbonding period info", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    // Should show unbonding period
    await expect(page.getByText(/Unbonding period/)).toBeVisible({ timeout: 10_000 })
  })

  test("dialog can be closed", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const delegateButtons = page.getByRole("button", { name: "Delegate" })
    await delegateButtons.first().click()

    await expect(page.getByRole("heading", { name: "Delegate SAFE" })).toBeVisible()

    // Close with Escape
    await page.keyboard.press("Escape")

    await expect(page.getByRole("heading", { name: "Delegate SAFE" })).not.toBeVisible()
  })
})
