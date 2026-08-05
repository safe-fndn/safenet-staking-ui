import { test, expect } from "../fixtures/base.fixture"

/**
 * Smoke coverage only. `isSafeApp` (src/lib/safe.ts) is purely `window.self !== window.top`,
 * so a bare iframe is enough to exercise the UI branch that hides Connect/Disconnect — no
 * response is needed from a "Safe host" for that. Fully simulating the Safe Apps SDK
 * postMessage protocol (so the auto-connect in useAutoConnect.ts actually succeeds and
 * transactions can be driven end-to-end) was scoped out; full transactional coverage for
 * the Safe App connection mode is manual-QA-only — see MANUAL_TESTING.md.
 */
test.describe("Safe App (smoke)", () => {
  test("hides Connect/Disconnect buttons but still renders public data inside an iframe", async ({ disconnectedPage: page }) => {
    // Same-origin as the app itself: a cross-origin "Safe host" gets blocked by Chrome's
    // Private Network Access checks when embedding a localhost iframe (public -> local).
    // The wrapper page's own origin doesn't matter for what we're testing (isSafeApp is
    // purely window.self !== window.top), so serving it from the app's own origin sidesteps
    // that restriction entirely.
    const hostPath = "/__safe_host_test__"
    await page.route(`**${hostPath}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: `<!DOCTYPE html><html><body style="margin:0"><iframe src="/#/validators" style="width:100vw;height:100vh;border:0"></iframe></body></html>`,
      })
    })

    await page.goto(hostPath)
    const app = page.frameLocator("iframe")

    // Public data (validator name, stake, participation) still renders without any connection
    await expect(app.getByRole("link", { name: "Validator A" })).toBeVisible({ timeout: 15_000 })
    await expect(app.getByText("Total SAFE Staked").first()).toBeVisible()

    // In a Safe App iframe, auto-connect handles the connection — no manual Connect/Disconnect UI
    await expect(app.getByRole("button", { name: "Connect Wallet" })).toHaveCount(0)
    await expect(app.getByRole("button", { name: "Disconnect" })).toHaveCount(0)
  })
})
