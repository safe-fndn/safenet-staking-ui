import type { Page, Locator } from "@playwright/test"

export class WithdrawalsPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly connectMessage: Locator
  readonly noPendingMessage: Locator
  readonly pendingHeading: Locator
  readonly fifoInfoButton: Locator
  readonly withdrawalCards: Locator
  readonly claimButton: Locator
  readonly readyToClaim: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Withdrawals", level: 1 })
    this.subtitle = page.getByText("Manage your pending withdrawals")
    this.connectMessage = page.getByText("Connect your wallet to view withdrawal queue")
    this.noPendingMessage = page.getByText("No pending withdrawals")
    this.pendingHeading = page.getByRole("heading", { name: "Pending Withdrawals" })
    this.fifoInfoButton = page.getByLabel("Withdrawal queue info")
    this.withdrawalCards = page.locator("[class*='Card']").filter({ has: page.getByText("SAFE") })
    this.claimButton = page.getByRole("button", { name: "Claim" })
    this.readyToClaim = page.getByText("Ready to claim")
  }

  async goto() {
    await this.page.goto("/withdrawals")
  }
}
