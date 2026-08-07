import { test, expect } from "../fixtures/base.fixture"
import { LayoutPage } from "../pages/layout.page"
import { TEST_USER } from "../fixtures/test-data"

test.describe("Wallet Connection", () => {
  test("shows Connect Wallet button when disconnected", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await expect(layout.connectButton).toBeVisible()
  })

  test("opens connector menu on Connect Wallet click", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await layout.connectButton.click()

    // Should show connector options in a menu
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
  })

  test("shows wallet address when connected", async ({ connectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    // Should show truncated address instead of Connect Wallet
    const truncated = TEST_USER.slice(0, 6) + "..." + TEST_USER.slice(-4)
    // Wait for the connected state - address should appear
    await expect(page.getByText(truncated)).toBeVisible({ timeout: 10_000 })
  })

  test("shows Disconnect button when connected", async ({ connectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await expect(layout.disconnectButton).toBeVisible({ timeout: 10_000 })
  })

  test("shows SAFE balance when connected", async ({ connectedPage: page }) => {
    await page.goto("/")

    // Balance is shown as a number next to the SAFE token icon (no "SAFE" text suffix)
    await expect(page.getByText("1,000")).toBeVisible({ timeout: 10_000 })
  })

  // WalletConnect pairing requires a real relay/wallet and isn't automatable — this only
  // checks that the connector is wired up via VITE_WALLETCONNECT_PROJECT_ID. Full
  // functional coverage for this connection mode is manual-QA-only, see MANUAL_TESTING.md.
  test("lists WalletConnect as a connector option", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await layout.connectButton.click()

    await expect(page.getByRole("menuitem", { name: "WalletConnect" })).toBeVisible()
  })

  test("prompts to switch network when connected to the wrong chain", async ({ wrongNetworkPage: page }) => {
    await page.goto("/")

    await expect(page.getByRole("button", { name: "Switch to Sepolia" })).toBeVisible({ timeout: 10_000 })
    // Balance/actions are hidden until the user switches back to the right network
    await expect(page.getByText("1,000")).not.toBeVisible()
  })
})
