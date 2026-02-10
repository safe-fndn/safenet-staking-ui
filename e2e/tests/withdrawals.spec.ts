import { test, expect } from "../fixtures/base.fixture"
import { WithdrawalsPage } from "../pages/withdrawals.page"

test.describe("Withdrawals Page", () => {
  test("shows connect message when disconnected", async ({ disconnectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.heading).toBeVisible()
    await expect(withdrawals.connectMessage).toBeVisible()
  })

  test("shows pending withdrawals when connected", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.heading).toBeVisible()

    // Should show pending withdrawals heading (our mock has 1 withdrawal)
    await expect(withdrawals.pendingHeading).toBeVisible({ timeout: 10_000 })
  })

  test("shows FIFO info tooltip trigger", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.pendingHeading).toBeVisible({ timeout: 10_000 })
    await expect(withdrawals.fifoInfoButton).toBeVisible()
  })

  test("shows withdrawal amount in SAFE", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.pendingHeading).toBeVisible({ timeout: 10_000 })

    // Our mock has a 50 SAFE pending withdrawal
    await expect(page.getByText(/50(\.0+)?\s*SAFE/)).toBeVisible()
  })

  test("shows ready to claim status for past claimable time", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    // Our mock has claimableAt set to 1 hour in the past
    await expect(withdrawals.readyToClaim).toBeVisible({ timeout: 10_000 })
  })

  test("shows claim button for first claimable withdrawal", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.claimButton).toBeVisible({ timeout: 10_000 })
  })
})
