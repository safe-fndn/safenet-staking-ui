/**
 * Core Playwright fixtures providing connected and disconnected page states.
 */

import { test as base, type Page } from "@playwright/test"
import { createEthereumProviderScript, createDisconnectedProviderScript } from "../mocks/ethereum-provider"
import { createRpcHandler } from "../mocks/rpc-handler"
import { createMockChainState, applyMockTx, type MockChainState } from "../mocks/mock-chain-state"
import { CHAIN_ID_HEX, WRONG_CHAIN_ID_HEX, TEST_USER, VALIDATORS } from "./test-data"

export type TestFixtures = {
  /** Mutable mock chain state (balances, stakes, withdrawals, rewards) for this test. */
  mockChainState: MockChainState
  /** Page with mock wallet connected (has accounts) */
  connectedPage: Page
  /** Page with mock wallet but no connected accounts */
  disconnectedPage: Page
  /** Page with mock wallet connected but reporting a chain id other than CHAIN_ID_HEX */
  wrongNetworkPage: Page
  /** Page with mock wallet connected and advertising EIP-5792 atomicBatch support */
  batchingPage: Page
}

interface SetupPageOptions {
  connected: boolean
  chainIdHex?: string
  supportsBatching?: boolean
}

const MOCK_VALIDATORS = [
  {
    address: VALIDATORS.validatorA,
    is_active: true,
    label: "Validator A",
    commission: 0.05,
    participation_rate_14d: 0.999,
  },
  {
    address: VALIDATORS.validatorB,
    is_active: true,
    label: "Validator B",
    commission: 0.03,
    participation_rate_14d: 0.985,
  },
]

async function setupPage(page: Page, options: SetupPageOptions, state: MockChainState): Promise<Page> {
  const { connected, chainIdHex = CHAIN_ID_HEX, supportsBatching } = options

  // Bridge eth_sendTransaction (handled entirely inside the injected browser script,
  // see ethereum-provider.ts) back into the Node-side mock chain state, so RPC reads
  // reflect the effect of a "submitted" transaction (approve, stake, claim, ...).
  await page.exposeFunction("__mockTx", (data: string) => applyMockTx(state, data, TEST_USER))
  // Lets a test simulate the user rejecting a wallet prompt (see rejectNextTx).
  await page.exposeFunction("__shouldRejectTx", () => {
    const should = state.rejectNextTx
    state.rejectNextTx = false
    return should
  })

  // Inject ethereum provider before the app loads
  if (connected) {
    await page.addInitScript(
      createEthereumProviderScript({
        chainIdHex,
        accounts: [TEST_USER],
        supportsBatching,
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
    await page.addInitScript(createDisconnectedProviderScript(chainIdHex))
  }

  // Intercept all RPC requests to the mock URL
  const handler = createRpcHandler(TEST_USER, state)
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

  // Intercept the reward proof endpoint (see src/hooks/useRewardProof.ts). Served from
  // `state.rewardProof`, so tests can configure per-address rewards before navigating.
  // Undefined (the default) is served as a 404, matching "this address never earned rewards".
  await page.route("**/mock-rewards.test/**", async (route) => {
    const proof = state.rewardProof
    if (!proof) {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" })
      return
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(proof) })
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
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires this signature
  mockChainState: async ({}, use) => {
    await use(createMockChainState()) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  connectedPage: async ({ page, mockChainState }, use) => {
    const p = await setupPage(page, { connected: true }, mockChainState)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  disconnectedPage: async ({ page, mockChainState }, use) => {
    const p = await setupPage(page, { connected: false }, mockChainState)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  wrongNetworkPage: async ({ page, mockChainState }, use) => {
    const p = await setupPage(page, { connected: true, chainIdHex: WRONG_CHAIN_ID_HEX }, mockChainState)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
  batchingPage: async ({ page, mockChainState }, use) => {
    const p = await setupPage(page, { connected: true, supportsBatching: true }, mockChainState)
    await use(p) // eslint-disable-line react-hooks/rules-of-hooks -- Playwright fixture API, not a React hook
  },
})

export { expect } from "@playwright/test"
