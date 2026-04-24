import { test, expect } from "../fixtures/base.fixture"

test.describe("Undelegation Dialog", () => {
  test("opens undelegate dialog from validator card", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Click Unstake on a card that has a stake
    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await unstakeButtons.first().click()

    await expect(page.getByRole("heading", { name: "Unstake SAFE" })).toBeVisible()
  })

  test("dialog shows amount input with unstake label", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await unstakeButtons.first().click()

    await expect(page.getByLabel("Unstake Amount")).toBeVisible()
  })

  test("shows unstaking period with claim info", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await unstakeButtons.first().click()

    await expect(page.getByText(/Unstaking period/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/claimable after/i)).toBeVisible()
  })

  test("initiate withdrawal button is disabled without amount", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await unstakeButtons.first().click()

    const initiateButton = page.getByRole("button", { name: "Initiate Withdrawal" })
    await expect(initiateButton).toBeDisabled()
  })

  test("dialog can be closed", async ({ connectedPage: page }) => {
    await page.goto("/#/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await unstakeButtons.first().click()

    await expect(page.getByRole("heading", { name: "Unstake SAFE" })).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(page.getByRole("heading", { name: "Unstake SAFE" })).not.toBeVisible()
  })
})
