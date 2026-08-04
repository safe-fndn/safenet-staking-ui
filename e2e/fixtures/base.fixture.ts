/**
 * Core Playwright fixtures providing connected and disconnected page states.
 */

import { test as base, type Page, type Route } from "@playwright/test"
import { createEthereumProviderScript, createDisconnectedProviderScript } from "../mocks/ethereum-provider"
import { createRpcHandler } from "../mocks/rpc-handler"
import { CHAIN_ID_HEX, TEST_USER, NO_STAKE_USER, MOCK_REWARD_PROOF } from "./test-data"

export type TestFixtures = {
  /** Page with mock wallet connected (has accounts, TEST_USER has active stakes) */
  connectedPage: Page
  /** Page with mock wallet but no connected accounts */
  disconnectedPage: Page
  /** Page with mock wallet connected to an address with no active stake on any validator */
  noActiveStakePage: Page
  /** Page with mock wallet connected and EIP-5792 atomic batch support advertised */
  batchCapablePage: Page
}

interface SetupOptions {
  connected: boolean
  userAddress?: string
  supportsAtomicBatch?: boolean
  mockRewards?: boolean
}

function rewardProofHandler(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(MOCK_REWARD_PROOF),
  })
}

async function setupPage(page: Page, options: SetupOptions): Promise<Page> {
  const { connected, userAddress = TEST_USER, supportsAtomicBatch = false, mockRewards = false } = options

  // Inject ethereum provider before the app loads
  if (connected) {
    await page.addInitScript(
      createEthereumProviderScript({
        chainIdHex: CHAIN_ID_HEX,
        accounts: [userAddress],
        supportsAtomicBatch,
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
  const handler = createRpcHandler(connected ? userAddress : undefined)
  await page.route("**/mock-rpc.test/**", handler)
  await page.route("**/mock-rpc.test", handler)

  if (mockRewards) {
    await page.route("**/mock-rewards.test/**", rewardProofHandler)
  }

  return page
}

export const test = base.extend<TestFixtures>({
  connectedPage: async ({ page }, use) => {
    const p = await setupPage(page, { connected: true, mockRewards: true })
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  disconnectedPage: async ({ page }, use) => {
    const p = await setupPage(page, { connected: false })
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  noActiveStakePage: async ({ page }, use) => {
    const p = await setupPage(page, { connected: true, userAddress: NO_STAKE_USER, mockRewards: true })
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  batchCapablePage: async ({ page }, use) => {
    const p = await setupPage(page, { connected: true, supportsAtomicBatch: true, mockRewards: true })
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
})

export { expect } from "@playwright/test"
