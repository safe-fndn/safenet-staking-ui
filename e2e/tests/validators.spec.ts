import { test, expect } from "../fixtures/base.fixture"
import { ValidatorsPage } from "../pages/validators.page"

test.describe("Validators Page", () => {
  test("renders heading and controls", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(validators.heading).toBeVisible()
    await expect(validators.subtitle).toBeVisible()
    await expect(validators.searchInput).toBeVisible({ timeout: 10_000 })
    await expect(validators.sortSelect).toBeVisible()
  })

  test("displays validator cards", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    // Wait for validators to load — look for known validator names
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole("link", { name: "Greenfield" })).toBeVisible()
  })

  test("search filters validators by name", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    // Wait for load
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Search for "Gnosis"
    await validators.searchInput.fill("Gnosis")

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Greenfield" })).not.toBeVisible()
  })

  test("search with no results shows message", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    await validators.searchInput.fill("nonexistent-validator-xyz")

    await expect(validators.noMatchMessage).toBeVisible()
  })

  test("status filter buttons work", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Filter: Active only
    await validators.filterActive.click()
    // Both validators are active, so both should still show
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible()

    // Filter: Inactive
    await validators.filterInactive.click()
    // No inactive validators in mock data
    await expect(validators.noMatchMessage).toBeVisible()

    // Back to All
    await validators.filterAll.click()
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible()
  })

  test("sort select has options", async ({ disconnectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    await expect(validators.sortSelect).toBeVisible({ timeout: 10_000 })

    // Check option values
    const options = validators.sortSelect.locator("option")
    await expect(options).toHaveCount(3)
  })

  test("validator cards show delegate/undelegate buttons when connected", async ({ connectedPage: page }) => {
    const validators = new ValidatorsPage(page)
    await validators.goto()

    // Wait for validator cards to render
    await expect(page.getByRole("link", { name: "Gnosis" })).toBeVisible({ timeout: 15_000 })

    // Should see Stake buttons
    const stakeButtons = page.getByRole("button", { name: "Stake" })
    await expect(stakeButtons.first()).toBeVisible()

    // Should see Unstake buttons
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
