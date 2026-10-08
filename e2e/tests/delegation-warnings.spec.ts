import type { Page } from "@playwright/test"
import { test, expect, MOCK_VALIDATORS } from "../fixtures/base.fixture"
import { VALIDATORS } from "../fixtures/test-data"

const INACTIVE_WARNING = "You have delegated to an inactive validator. Please review your stake."
const LOW_PARTICIPATION_WARNING =
  "You have delegated to a validator with participation below 75%. Please review your stake."

type ValidatorOverride = Partial<(typeof MOCK_VALIDATORS)[number]>

/**
 * Serve a validator info payload with per-validator overrides.
 * Registered after the fixture's route, so Playwright runs this handler first.
 */
async function routeValidators(page: Page, overrides: Record<string, ValidatorOverride>) {
  await page.route("**/mock-validators.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_VALIDATORS.map((v) => ({ ...v, ...overrides[v.address] }))),
    })
  })
}

function inactiveBanner(page: Page) {
  return page.getByRole("alert").filter({ hasText: INACTIVE_WARNING })
}

function lowParticipationBanner(page: Page) {
  return page.getByRole("alert").filter({ hasText: LOW_PARTICIPATION_WARNING })
}

/** Wait until the positions table has loaded, so the absence of banners is meaningful. */
async function gotoDashboardLoaded(page: Page) {
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
}

async function topOf(page: Page, locator: ReturnType<Page["getByText"]>) {
  const box = await locator.boundingBox()
  if (!box) throw new Error("element not rendered")
  return box.y
}

test.describe("Delegation warnings", () => {
  test.describe("overview", () => {
    test("names each affected validator below the hero", async ({ connectedPage: page }) => {
      await routeValidators(page, {
        [VALIDATORS.validatorA]: { is_active: false },
        [VALIDATORS.validatorB]: { participation_rate_14d: 0.6 },
      })
      await page.goto("/")

      await expect(inactiveBanner(page)).toBeVisible({ timeout: 15_000 })
      await expect(inactiveBanner(page).getByRole("link", { name: "Validator A" })).toBeVisible()
      await expect(inactiveBanner(page).getByRole("link", { name: "Validator B" })).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toBeVisible()
      await expect(lowParticipationBanner(page).getByRole("link", { name: "Validator B" })).toBeVisible()
      await expect(lowParticipationBanner(page).getByRole("link", { name: "Validator A" })).toHaveCount(0)

      const heroY = await topOf(page, page.getByRole("heading", { name: "Stake your SAFE" }))
      const bannerY = await topOf(page, inactiveBanner(page))
      const statsY = await topOf(page, page.getByText("Total SAFE Staked").first())
      expect(heroY).toBeLessThan(bannerY)
      expect(bannerY).toBeLessThan(statsY)
    })

    test("shows both banners for one validator matching both conditions", async ({ connectedPage: page }) => {
      await routeValidators(page, {
        [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.5 },
      })
      await page.goto("/")

      await expect(inactiveBanner(page).getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
      await expect(lowParticipationBanner(page).getByRole("link", { name: "Validator A" })).toBeVisible()
    })

    test("does not warn at exactly 75% participation", async ({ connectedPage: page }) => {
      await routeValidators(page, { [VALIDATORS.validatorB]: { participation_rate_14d: 0.75 } })
      await gotoDashboardLoaded(page)

      await expect(page.getByRole("link", { name: "Validator B" })).toBeVisible()
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })

    test("does not warn without stake on the affected validator", async ({ connectedPage: page, mockChainState }) => {
      await routeValidators(page, { [VALIDATORS.validatorB]: { is_active: false, participation_rate_14d: 0.1 } })
      mockChainState.stakes.set(VALIDATORS.validatorB.toLowerCase(), 0n)
      await gotoDashboardLoaded(page)

      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })

    test("does not warn when no wallet is connected", async ({ disconnectedPage: page }) => {
      await routeValidators(page, { [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.1 } })
      await page.goto("/")

      await expect(page.getByText("Active Validators")).toBeVisible({ timeout: 15_000 })
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })
  })

  test.describe("validators overview", () => {
    test("names each affected validator below the hero", async ({ connectedPage: page }) => {
      await routeValidators(page, {
        [VALIDATORS.validatorA]: { is_active: false },
        [VALIDATORS.validatorB]: { participation_rate_14d: 0.6 },
      })
      await page.goto("/#/validators")

      await expect(inactiveBanner(page).getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
      await expect(lowParticipationBanner(page).getByRole("link", { name: "Validator B" })).toBeVisible()

      const heroY = await topOf(page, page.getByRole("heading", { name: "Safenet Aegis" }))
      const bannerY = await topOf(page, inactiveBanner(page))
      const firstCardY = await topOf(page, page.getByTitle("Copy validator address").first())
      expect(heroY).toBeLessThan(bannerY)
      expect(bannerY).toBeLessThan(firstCardY)
    })

    test("does not warn without stake on the affected validator", async ({ connectedPage: page, mockChainState }) => {
      await routeValidators(page, { [VALIDATORS.validatorB]: { is_active: false, participation_rate_14d: 0.1 } })
      mockChainState.stakes.set(VALIDATORS.validatorB.toLowerCase(), 0n)
      await page.goto("/#/validators")

      await expect(page.getByText("Validator B").first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText("300", { exact: true })).toBeVisible()
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })

    test("does not warn when no wallet is connected", async ({ disconnectedPage: page }) => {
      await routeValidators(page, { [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.1 } })
      await page.goto("/#/validators")

      await expect(page.getByText("Validator A").first()).toBeVisible({ timeout: 15_000 })
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })
  })

  test.describe("validator page", () => {
    test("shows warnings for the viewed validator above its card", async ({ connectedPage: page }) => {
      await routeValidators(page, {
        [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.5 },
      })
      await page.goto(`/#/validators/${VALIDATORS.validatorA}`)

      await expect(inactiveBanner(page)).toBeVisible({ timeout: 15_000 })
      await expect(lowParticipationBanner(page)).toBeVisible()

      const backY = await topOf(page, page.getByRole("link", { name: "Back to Validators" }))
      const bannerY = await topOf(page, inactiveBanner(page))
      const cardY = await topOf(page, page.getByText("Total SAFE Staked"))
      expect(backY).toBeLessThan(bannerY)
      expect(bannerY).toBeLessThan(cardY)
    })

    test("does not show warnings for other affected validators", async ({ connectedPage: page }) => {
      await routeValidators(page, {
        [VALIDATORS.validatorB]: { is_active: false, participation_rate_14d: 0.5 },
      })
      await page.goto(`/#/validators/${VALIDATORS.validatorA}`)

      await expect(page.getByText("Your SAFE Staked")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText("300", { exact: true })).toBeVisible()
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })

    test("does not warn without stake on the validator", async ({ connectedPage: page, mockChainState }) => {
      await routeValidators(page, { [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.5 } })
      mockChainState.stakes.set(VALIDATORS.validatorA.toLowerCase(), 0n)
      await page.goto(`/#/validators/${VALIDATORS.validatorA}`)

      await expect(page.getByText("Your SAFE Staked")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole("button", { name: "Unstake" })).toBeDisabled()
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })

    test("does not warn when no wallet is connected", async ({ disconnectedPage: page }) => {
      await routeValidators(page, { [VALIDATORS.validatorA]: { is_active: false, participation_rate_14d: 0.5 } })
      await page.goto(`/#/validators/${VALIDATORS.validatorA}`)

      await expect(page.getByText("Total SAFE Staked")).toBeVisible({ timeout: 15_000 })
      await expect(inactiveBanner(page)).toHaveCount(0)
      await expect(lowParticipationBanner(page)).toHaveCount(0)
    })
  })
})
