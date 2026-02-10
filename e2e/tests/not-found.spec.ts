import { test, expect } from "../fixtures/base.fixture"

test.describe("404 Not Found", () => {
  test("shows 404 page for unknown routes", async ({ disconnectedPage: page }) => {
    await page.goto("/some-random-page")

    await expect(page.getByRole("heading", { name: "404" })).toBeVisible()
    await expect(page.getByText("Page not found")).toBeVisible()
  })

  test("has link back to dashboard", async ({ disconnectedPage: page }) => {
    await page.goto("/nonexistent")

    const backLink = page.getByRole("link", { name: "Back to Dashboard" })
    await expect(backLink).toBeVisible()

    await backLink.click()
    await expect(page).toHaveURL("/")
  })
})
