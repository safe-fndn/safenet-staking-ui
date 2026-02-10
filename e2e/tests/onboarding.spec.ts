import { test, expect } from "../fixtures/base.fixture"

test.describe("Onboarding Banner", () => {
  test("shows onboarding banner for disconnected users", async ({ disconnectedPage: page }) => {
    // Clear localStorage to ensure onboarding is shown
    await page.goto("/")
    await page.evaluate(() => localStorage.removeItem("onboarding_dismissed"))
    await page.reload()

    await expect(page.getByText("Welcome to Safe Staking")).toBeVisible()
    await expect(page.getByText("Connect your wallet", { exact: true })).toBeVisible()
    await expect(page.getByText("Choose a validator")).toBeVisible()
    await expect(page.getByText("Track your rewards")).toBeVisible()
  })

  test("dismiss button hides onboarding banner", async ({ disconnectedPage: page }) => {
    await page.goto("/")
    await page.evaluate(() => localStorage.removeItem("onboarding_dismissed"))
    await page.reload()

    await expect(page.getByText("Welcome to Safe Staking")).toBeVisible()

    await page.getByRole("button", { name: "Dismiss", exact: true }).click()

    await expect(page.getByText("Welcome to Safe Staking")).not.toBeVisible()
  })

  test("dismiss persists across page reloads via localStorage", async ({ disconnectedPage: page }) => {
    await page.goto("/")
    await page.evaluate(() => localStorage.removeItem("onboarding_dismissed"))
    await page.reload()

    await expect(page.getByText("Welcome to Safe Staking")).toBeVisible()

    await page.getByRole("button", { name: "Dismiss", exact: true }).click()

    // Reload and verify it stays dismissed
    await page.reload()
    await expect(page.getByText("Welcome to Safe Staking")).not.toBeVisible()

    // Verify localStorage
    const dismissed = await page.evaluate(() => localStorage.getItem("onboarding_dismissed"))
    expect(dismissed).toBe("true")
  })

  test("close icon button also dismisses banner", async ({ disconnectedPage: page }) => {
    await page.goto("/")
    await page.evaluate(() => localStorage.removeItem("onboarding_dismissed"))
    await page.reload()

    await expect(page.getByText("Welcome to Safe Staking")).toBeVisible()

    // The X close button
    await page.getByLabel("Dismiss onboarding").click()

    await expect(page.getByText("Welcome to Safe Staking")).not.toBeVisible()
  })
})
