import type { Page, Locator } from "@playwright/test"

export class ValidatorDetailPage {
  readonly page: Page
  readonly backLink: Locator
  readonly validatorName: Locator
  readonly statusBadge: Locator
  readonly copyAddressButton: Locator
  readonly totalDelegated: Locator
  readonly yourDelegation: Locator
  readonly delegateButton: Locator
  readonly undelegateButton: Locator
  readonly txHistory: Locator
  readonly notFoundMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.backLink = page.getByRole("link", { name: "Back to Validators" })
    this.validatorName = page.locator("h2, [class*='CardTitle']").first()
    this.statusBadge = page.locator("[class*='badge'], [class*='Badge']").first()
    this.copyAddressButton = page.getByLabel("Copy address")
    this.totalDelegated = page.getByText("Total Delegated").locator("..")
    this.yourDelegation = page.getByText("Your Delegation").locator("..")
    this.delegateButton = page.getByRole("button", { name: "Delegate", exact: true })
    this.undelegateButton = page.getByRole("button", { name: "Undelegate", exact: true })
    this.txHistory = page.getByText("Transaction History", { exact: true })
    this.notFoundMessage = page.getByText("Validator not found")
  }

  async goto(address: string) {
    await this.page.goto(`/validators/${address}`)
  }
}
