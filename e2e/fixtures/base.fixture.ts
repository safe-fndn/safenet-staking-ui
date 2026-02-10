/**
 * Core Playwright fixtures providing connected and disconnected page states.
 */

import { test as base, type Page } from "@playwright/test"
import { createEthereumProviderScript, createDisconnectedProviderScript } from "../mocks/ethereum-provider"
import { createRpcHandler } from "../mocks/rpc-handler"
import { CHAIN_ID_HEX, TEST_USER } from "./test-data"

export type TestFixtures = {
  /** Page with mock wallet connected (has accounts) */
  connectedPage: Page
  /** Page with mock wallet but no connected accounts */
  disconnectedPage: Page
}

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

  return page
}

export const test = base.extend<TestFixtures>({
  connectedPage: async ({ page }, use) => {
    const p = await setupPage(page, true)
    await use(p)
  },
  disconnectedPage: async ({ page }, use) => {
    const p = await setupPage(page, false)
    await use(p)
  },
})

export { expect } from "@playwright/test"
