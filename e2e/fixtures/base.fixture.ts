/**
 * Core Playwright fixtures providing connected and disconnected page states.
 */

import { test as base, type Page } from "@playwright/test"
import { createEthereumProviderScript, createDisconnectedProviderScript } from "../mocks/ethereum-provider"
import { createRpcHandler } from "../mocks/rpc-handler"
import { CHAIN_ID_HEX, TEST_USER, VALIDATORS } from "./test-data"

export type TestFixtures = {
  /** Page with mock wallet connected (has accounts) */
  connectedPage: Page
  /** Page with mock wallet but no connected accounts */
  disconnectedPage: Page
}

const MOCK_VALIDATORS = [
  {
    address: VALIDATORS.gnosis,
    is_active: true,
    label: "Gnosis",
    commission: 0.05,
    participation_rate_14d: 0.999,
  },
  {
    address: VALIDATORS.greenfield,
    is_active: true,
    label: "Greenfield",
    commission: 0.03,
    participation_rate_14d: 0.985,
  },
]

async function setupPage(page: Page, connected: boolean): Promise<Page> {
  // Inject ethereum provider before the app loads
  if (connected) {
    await page.addInitScript(
      createEthereumProviderScript({
        chainIdHex: CHAIN_ID_HEX,
        accounts: [TEST_USER],
      })
    )
    // Seed wagmi localStorage so it auto-reconnects to the injected connector.
    // wagmi v3 stores:
    //   wagmi.recentConnectorId = JSON.stringify("injected")
    //   wagmi.injected.connected = JSON.stringify(true)
    await page.addInitScript(() => {
      localStorage.setItem("wagmi.recentConnectorId", JSON.stringify("injected"))
      localStorage.setItem("wagmi.injected.connected", JSON.stringify(true))
    })
  } else {
    await page.addInitScript(createDisconnectedProviderScript(CHAIN_ID_HEX))
  }

  // Intercept all RPC requests to the mock URL
  const handler = createRpcHandler(connected ? TEST_USER : undefined)
  await page.route("**/mock-rpc.test/**", handler)
  await page.route("**/mock-rpc.test", handler)

  // Intercept validator info endpoint with test data so tests use known addresses
  await page.route("**/mock-validators.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_VALIDATORS),
    })
  })

  // Mock geo-check APIs so the app renders instead of showing RestrictedScreen
  await page.route("**/api.country.is**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ country: "US", ip: "1.2.3.4" }),
    })
  })
  await page.route("**/ipapi.co/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/plain", body: "US" })
  })

  return page
}

export const test = base.extend<TestFixtures>({
  connectedPage: async ({ page }, use) => {
    const p = await setupPage(page, true)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  disconnectedPage: async ({ page }, use) => {
    const p = await setupPage(page, false)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
})

export { expect } from "@playwright/test"
