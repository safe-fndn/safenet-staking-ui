import { test, expect } from "../fixtures/base.fixture"
import { ValidatorsPage } from "../pages/validators.page"

test.describe("Validators Page", () => {
  test("renders heading and subtitle", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(validators.heading).toBeVisible()
    await expect(validators.subtitle).toBeVisible()
  })

  test("displays validator cards", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    // Wait for validators to load — look for known validator names
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: "Greenfield" })).toBeVisible()
  })

  test("validator cards show stake/unstake buttons when connected", async ({ connectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    // Wait for validator cards to render
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Should see Stake buttons
    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await expect(stakeButtons.first()).toBeVisible()

    // Should see Unstake buttons (may be disabled if no stake yet)
    const unstakeButtons = page.getByRole("button", { name: "Unstake" })
    await expect(unstakeButtons.first()).toBeVisible()
  })

  test("validator card links to detail page", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    await page.getByRole("link", { name: "Gnosis" }).click()
    await expect(page).toHaveURL(/\/validators\/0x/)
  })
})
