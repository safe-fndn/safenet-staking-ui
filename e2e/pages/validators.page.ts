import type { Page, Locator } from "@playwright/test"

export class ValidatorsPage {
  readonly page: Page
  readonly heading: Locator
  readonly subtitle: Locator
  readonly searchInput: Locator
  readonly filterAll: Locator
  readonly filterActive: Locator
  readonly filterInactive: Locator
  readonly sortSelect: Locator
  readonly validatorCards: Locator
  readonly noMatchMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "Safenet Beta", level: 1 })
    this.subtitle = page.getByText("Select a validator to stake your SAFE tokens")
    this.searchInput = page.getByPlaceholder("Search by name or address")
    this.filterAll = page.getByRole("button", { name: "All", exact: true })
    this.filterActive = page.getByRole("button", { name: "Active", exact: true })
    this.filterInactive = page.getByRole("button", { name: "Inactive", exact: true })
    this.sortSelect = page.getByLabel("Sort validators")
    this.validatorCards = page.locator("[class*='grid'] > div").filter({ has: page.getByText("Total Delegated") })
    this.noMatchMessage = page.getByText("No validators match your search criteria")
  }

  async goto() {
    await this.page.goto("/validators")
  }

  getValidatorCard(name: string): Locator {
    return this.page.locator("div").filter({ has: this.page.getByRole("link", { name }) }).filter({ has: this.page.getByText("Total Delegated") })
  }

  getDelegateButton(cardLocator: Locator): Locator {
    return cardLocator.getByRole("button", { name: "Delegate" })
  }

  getUndelegateButton(cardLocator: Locator): Locator {
    return cardLocator.getByRole("button", { name: "Undelegate" })
  }
}
