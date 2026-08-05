import { test, expect } from "../fixtures/base.fixture"
import { ValidatorDetailPage } from "../pages/validator-detail.page"
import { VALIDATORS } from "../fixtures/test-data"

test.describe("Validator Detail Page", () => {
  test("shows validator info for known validator", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(page.getByText("Validator A")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText("Active")).toBeVisible()
  })

  test("shows commission and uptime metadata", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(page.getByText("Validator A")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Commission:.*5%/)).toBeVisible()
    await expect(page.getByText(/Participation.*99\.9%/)).toBeVisible()
  })

  test("shows total delegated amount", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(page.getByText("Total SAFE Staked")).toBeVisible({ timeout: 15_000 })
    // Total stake for mock Validator A validator is 5,000 SAFE
    await expect(page.getByText("5,000")).toBeVisible()
  })

  test("shows your delegation when connected", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(page.getByText("Your SAFE Staked")).toBeVisible({ timeout: 15_000 })
  })

  test("shows delegate and undelegate buttons", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(detail.delegateButton).toBeVisible({ timeout: 15_000 })
    await expect(detail.undelegateButton).toBeVisible()
  })

  test("back link navigates to validators list", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(detail.backLink).toBeVisible({ timeout: 15_000 })

    await detail.backLink.click()
    await expect(page).toHaveURL("/#/validators")
  })

  test("shows copy address button", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto(VALIDATORS.validatorA)

    await expect(detail.copyAddressButton).toBeVisible({ timeout: 15_000 })
  })

  test("shows not found for unknown validator", async ({ connectedPage: page }) => {
    const detail = new ValidatorDetailPage(page)
    await detail.goto("0x0000000000000000000000000000000000000099")

    await expect(detail.notFoundMessage).toBeVisible({ timeout: 15_000 })
  })
})
