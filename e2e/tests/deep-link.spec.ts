import { test, expect } from "../fixtures/base.fixture"
import { VALIDATORS } from "../fixtures/test-data"

test.describe("Deep Link", () => {
  test("?delegate=address auto-opens delegate dialog", async ({ connectedPage: page }) => {
    await page.goto(`/validators?delegate=${VALIDATORS.gnosis}`)

    // Wait for validators to load and the dialog to auto-open
    await expect(page.getByRole("heading", { name: "Delegate SAFE" })).toBeVisible({ timeout: 15_000 })
  })

  test("dialog mentions correct validator in description", async ({ connectedPage: page }) => {
    await page.goto(`/validators?delegate=${VALIDATORS.gnosis}`)

    await expect(page.getByRole("heading", { name: "Delegate SAFE" })).toBeVisible({ timeout: 15_000 })

    // Dialog description should mention the validator
    const truncated = VALIDATORS.gnosis.slice(0, 6) + "..." + VALIDATORS.gnosis.slice(-4)
    const descriptionText = `Delegate tokens toward validator ${truncated}`
    await expect(page.getByRole("dialog").getByText(descriptionText)).toBeVisible()
  })
})
