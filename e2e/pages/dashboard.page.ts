import type { Page, Locator } from "@playwright/test"

export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly statsCards: Locator
  readonly totalDelegatedCard: Locator
  readonly yourDelegatedCard: Locator
  readonly activeValidatorsCard: Locator
  readonly quickActionDelegate: Locator
  readonly quickActionUndelegate: Locator
  readonly quickActionClaim: Locator
  readonly onboardingBanner: Locator
  readonly onboardingDismissButton: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Stake your SAFE" })
    this.subtitle = page.getByText("Earn rewards for helping secure Safenet Beta")
    this.statsCards = page.locator("[class*='grid'] > div").filter({ has: page.locator("[class*='CardTitle']") })
    this.totalDelegatedCard = page.getByText("Total SAFE Staked").locator("../..")
    this.yourDelegatedCard = page.getByText("Your Staked SAFE").locator("../..")
    this.activeValidatorsCard = page.getByText("Active Validators").locator("../..")
    this.quickActionDelegate = page.getByRole("button", { name: /^Stake$/ }).first()
    this.quickActionUndelegate = page.getByRole("button", { name: /^Unstake$/ }).first()
    this.quickActionClaim = page.getByRole("button", { name: /^Withdraw$/ }).first()
    this.onboardingBanner = page.getByText("Welcome to Safe Staking")
    this.onboardingDismissButton = page.getByRole("button", { name: "Dismiss" })
  }

  async goto() {
    await this.page.goto("/")
  }
}
