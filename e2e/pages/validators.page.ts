import type { Page, Locator } from "@playwright/test"

export class ValidatorsPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly validatorCards: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Safenet Beta", level: 1 })
    this.subtitle = page.getByText("Select a validator to stake your SAFE tokens")
    this.validatorCards = page.locator("[class*='grid'] > div").filter({ has: page.getByText("Total SAFE Staked") })
  }

  async goto() {
    await this.page.goto("/#/validators")
  }

  getValidatorCard(name: string): Locator {
    return this.page.locator("div").filter({ has: this.page.getByRole("link", { name }) }).filter({ has: this.page.getByText("Total SAFE Staked") })
  }

  getDelegateButton(cardLocator: Locator): Locator {
    return cardLocator.getByRole("button", { name: "Stake" })
  }

  getUndelegateButton(cardLocator: Locator): Locator {
    return cardLocator.getByRole("button", { name: "Unstake" })
  }
}
