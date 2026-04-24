import { test, expect } from "../fixtures/base.fixture"
import { LayoutPage } from "../pages/layout.page"

test.describe("Navigation", () => {
  test("renders header with nav links and footer", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await expect(layout.header).toBeVisible()
    await expect(layout.footer).toBeVisible()
    await expect(layout.navDashboard).toBeVisible()
    await expect(layout.navValidators).toBeVisible()
    await expect(layout.navWithdrawals).toBeVisible()
  })

  test("dashboard link is active on home page", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto("/")

    // Wait for the nav to fully render before checking active state
    await expect(layout.navDashboard).toBeVisible()
    const active = await layout.getActiveNavItem()
    expect(active).toBe("Dashboard")
  })

  test("navigates to validators page", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto("/")

    await layout.navValidators.click()
    await expect(page).toHaveURL("/#/validators")

    const active = await layout.getActiveNavItem()
    expect(active).toBe("Validators")
  })

  test("navigates to withdrawals page", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto("/")

    await layout.navWithdrawals.click()
    await expect(page).toHaveURL("/#/withdrawals")

    const active = await layout.getActiveNavItem()
    expect(active).toBe("Withdrawals")
  })

  test("logo navigates back to dashboard", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto("/#/validators")

    await layout.logo.click()
    await expect(page).toHaveURL("/#/")
  })

  test("footer links are present", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await expect(layout.footerTerms).toBeVisible()
    await expect(layout.footerDocs).toBeVisible()
    await expect(layout.footerFaq).toBeVisible()
  })
})
