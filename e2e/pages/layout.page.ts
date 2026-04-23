import type { Page, Locator } from "@playwright/test"

export class LayoutPage {
  readonly page: Page
  readonly header: Locator
  readonly footer: Locator
  readonly navDashboard: Locator
  readonly navValidators: Locator
  readonly navWithdrawals: Locator
  readonly themeToggle: Locator
  readonly connectButton: Locator
  readonly disconnectButton: Locator
  readonly logo: Locator
  readonly footerTerms: Locator
  readonly footerDocs: Locator
  readonly footerFaq: Locator

  constructor(page: Page) {
    this.page = page
    this.header = page.locator("header")
    this.footer = page.locator("footer")
    this.navDashboard = page.getByRole("link", { name: "Dashboard" })
    this.navValidators = page.getByRole("link", { name: "Validators" })
    this.navWithdrawals = page.getByRole("link", { name: "Withdrawals" })
    this.themeToggle = page.getByRole("button", { name: /Switch to (light|dark) mode/ })
    this.connectButton = page.getByRole("button", { name: "Connect Wallet" })
    this.disconnectButton = page.getByRole("button", { name: "Disconnect" })
    this.logo = page.getByRole("link", { name: /Safe.*Staking/i }).first()
    this.footerTerms = page.getByRole("link", { name: "Terms" })
    this.footerDocs = page.getByRole("link", { name: "Documentation" })
    this.footerFaq = page.getByRole("link", { name: "FAQ" })
  }

  async goto(path = "/") {
    await this.page.goto(path)
  }

  async getActiveNavItem(): Promise<string | null> {
    const links = this.page.locator("header nav a[aria-current='page']")
    const count = await links.count()
    if (count === 0) return null
    return links.first().textContent()
  }

  async isDarkMode(): Promise<boolean> {
    return this.page.locator("html").evaluate((el) => el.classList.contains("dark"))
  }
}
