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

  test("claim happy path empties the queue", async ({ connectedPage: page }) => {
    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.claimButton).toBeVisible({ timeout: 10_000 })
    await withdrawals.claimButton.click()

    await expect(page.getByText("Withdrawal claimed")).toBeVisible({ timeout: 10_000 })
    await expect(withdrawals.noPendingMessage).toBeVisible({ timeout: 10_000 })
  })

  test("hides claim button and shows countdown when not yet claimable", async ({ connectedPage: page, mockChainState }) => {
    const futureClaimableAt = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour from now
    mockChainState.pendingWithdrawals = [{ amount: 50n * 10n ** 18n, claimableAt: futureClaimableAt }]

    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.pendingHeading).toBeVisible({ timeout: 10_000 })
    await expect(withdrawals.readyToClaim).not.toBeVisible()
    await expect(withdrawals.claimButton).not.toBeVisible()
    await expect(page.getByText("Cooldown progress")).toBeVisible()
  })

  test("only the oldest of several withdrawals shows a Claim button (FIFO)", async ({ connectedPage: page, mockChainState }) => {
    const now = Math.floor(Date.now() / 1000)
    mockChainState.pendingWithdrawals = [
      { amount: 50n * 10n ** 18n, claimableAt: BigInt(now - 3600) }, // ready
      { amount: 30n * 10n ** 18n, claimableAt: BigInt(now + 3600) }, // not yet
    ]

    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    await expect(withdrawals.pendingHeading).toBeVisible({ timeout: 10_000 })
    await expect(withdrawals.readyToClaim).toHaveCount(1)
    await expect(withdrawals.claimButton).toHaveCount(1)
    await expect(page.getByText("Cooldown progress")).toBeVisible()
  })

  test("Claim All (EIP-5792) happy path empties the queue", async ({ batchingPage: page, mockChainState }) => {
    const now = Math.floor(Date.now() / 1000)
    mockChainState.pendingWithdrawals = [
      { amount: 50n * 10n ** 18n, claimableAt: BigInt(now - 3600) },
      { amount: 30n * 10n ** 18n, claimableAt: BigInt(now - 1800) },
    ]

    const withdrawals = new WithdrawalsPage(page)
    await withdrawals.goto()

    const claimAllButton = page.getByRole("button", { name: "Claim All (2)" })
    await expect(claimAllButton).toBeVisible({ timeout: 10_000 })
    await claimAllButton.click()

    await expect(page.getByText("All withdrawals claimed")).toBeVisible({ timeout: 10_000 })
    await expect(withdrawals.noPendingMessage).toBeVisible({ timeout: 10_000 })
  })
})
