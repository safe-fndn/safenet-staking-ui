import { test, expect } from "../fixtures/base.fixture"
import { DashboardPage } from "../pages/dashboard.page"

test.describe("Dashboard", () => {
  test("renders page heading", async ({ disconnectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.subtitle).toBeVisible()
  })

  test("shows total delegated stat when disconnected", async ({ disconnectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    // Should show "Total SAFE Staked" card
    await expect(page.getByText("Total SAFE Staked")).toBeVisible({ timeout: 10_000 })
    // Should show "Active Validators" card
    await expect(page.getByText("Active Validators")).toBeVisible({ timeout: 10_000 })
  })

  test("shows user-specific stats when connected", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    // Wait for data to load
    await expect(page.getByText("Total SAFE Staked")).toBeVisible({ timeout: 10_000 })

    // Connected-only cards
    await expect(page.getByText("Your Staked SAFE")).toBeVisible({ timeout: 10_000 })
  })

  test("shows quick actions when connected", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.quickActionDelegate).toBeVisible({ timeout: 10_000 })
    await expect(dashboard.quickActionUndelegate).toBeVisible({ timeout: 10_000 })
    await expect(dashboard.quickActionClaim).toBeVisible({ timeout: 10_000 })
  })

  test("quick actions are hidden when disconnected", async ({ disconnectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    // Quick actions require connection
    await expect(page.getByRole("button", { name: /^Withdraw$/ })).not.toBeVisible()
  })

  test("shows transaction history with tabs when connected", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(page.getByText("Transaction History", { exact: true })).toBeVisible({ timeout: 10_000 })

    // Tabs
    await expect(dashboard.txTabAll).toBeVisible()
    await expect(dashboard.txTabDelegations).toBeVisible()
    await expect(dashboard.txTabWithdrawals).toBeVisible()
  })

  test("can switch transaction history tabs", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    // Wait for tx history to load
    await expect(dashboard.txTabAll).toBeVisible({ timeout: 10_000 })

    // Click Delegations tab
    await dashboard.txTabDelegations.click()
    // The tab panel should change (we can check tab is selected)
    await expect(dashboard.txTabDelegations).toHaveAttribute("data-state", "active")

    // Click Withdrawals tab
    await dashboard.txTabWithdrawals.click()
    await expect(dashboard.txTabWithdrawals).toHaveAttribute("data-state", "active")
  })

  test("delegate quick action navigates to validators", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await dashboard.quickActionDelegate.click()
    await expect(page).toHaveURL("/#/validators")
  })

  test("claim quick action navigates to withdrawals", async ({ connectedPage: page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await dashboard.quickActionClaim.click()
    await expect(page).toHaveURL("/#/withdrawals")
  })
})
