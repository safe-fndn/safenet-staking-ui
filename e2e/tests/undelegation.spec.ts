import { test, expect } from "../fixtures/base.fixture"

test.describe("Undelegation Dialog", () => {
  test("opens undelegate dialog from validator card", async ({ connectedPage: page }) => {
    await page.goto("/validators")

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Click Undelegate on a card that has a stake
    const undelegateButtons = page.getByRole("button", { name: "Undelegate" })
    await undelegateButtons.first().click()

    await expect(page.getByRole("heading", { name: "Undelegate SAFE" })).toBeVisible()
  })

  test("dialog shows amount input with undelegate label", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const undelegateButtons = page.getByRole("button", { name: "Undelegate" })
    await undelegateButtons.first().click()

    await expect(page.getByLabel("Undelegate Amount")).toBeVisible()
  })

  test("shows unbonding period with claim info", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const undelegateButtons = page.getByRole("button", { name: "Undelegate" })
    await undelegateButtons.first().click()

    await expect(page.getByText(/Unbonding period/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/claimable after/i)).toBeVisible()
  })

  test("initiate withdrawal button is disabled without amount", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const undelegateButtons = page.getByRole("button", { name: "Undelegate" })
    await undelegateButtons.first().click()

    const initiateButton = page.getByRole("button", { name: "Initiate Withdrawal" })
    await expect(initiateButton).toBeDisabled()
  })

  test("dialog can be closed", async ({ connectedPage: page }) => {
    await page.goto("/validators")
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    const undelegateButtons = page.getByRole("button", { name: "Undelegate" })
    await undelegateButtons.first().click()

    await expect(page.getByRole("heading", { name: "Undelegate SAFE" })).toBeVisible()

    await page.keyboard.press("Escape")

    await expect(page.getByRole("heading", { name: "Undelegate SAFE" })).not.toBeVisible()
  })
})
