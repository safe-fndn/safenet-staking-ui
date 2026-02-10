import { test, expect } from "../fixtures/base.fixture"
import { LayoutPage } from "../pages/layout.page"

test.describe("Dark Mode", () => {
  test("theme toggle button is visible", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    await expect(layout.themeToggle).toBeVisible()
  })

  test("toggles dark mode class on html element", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    // Clear any stored theme
    await page.evaluate(() => localStorage.removeItem("theme"))
    await page.reload()

    const initialDark = await layout.isDarkMode()

    await layout.themeToggle.click()

    const afterToggle = await layout.isDarkMode()
    expect(afterToggle).toBe(!initialDark)
  })

  test("persists theme preference in localStorage", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    // Set to light mode first
    await page.evaluate(() => {
      localStorage.setItem("theme", "light")
      document.documentElement.classList.remove("dark")
    })
    await page.reload()

    // Toggle to dark
    await layout.themeToggle.click()

    const theme = await page.evaluate(() => localStorage.getItem("theme"))
    expect(theme).toBe("dark")

    // Reload and verify persistence
    await page.reload()
    const isDark = await layout.isDarkMode()
    expect(isDark).toBe(true)
  })

  test("toggle button label changes with mode", async ({ disconnectedPage: page }) => {
    const layout = new LayoutPage(page)
    await layout.goto()

    // Set to light mode
    await page.evaluate(() => {
      localStorage.setItem("theme", "light")
      document.documentElement.classList.remove("dark")
    })
    await page.reload()

    // In light mode, button should say "Switch to dark mode"
    await expect(page.getByLabel("Switch to dark mode")).toBeVisible()

    // Toggle to dark
    await page.getByLabel("Switch to dark mode").click()

    // Now should say "Switch to light mode"
    await expect(page.getByLabel("Switch to light mode")).toBeVisible()
  })
})
