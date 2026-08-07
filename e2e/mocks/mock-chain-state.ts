/**
 * Mutable "chain state" shared between the Node-side RPC mock (e2e/mocks/rpc-handler.ts)
 * and the browser-side injected wallet (e2e/mocks/ethereum-provider.ts).
 *
 * eth_call reads (balances, stakes, allowance, ...) are served by the Node-side
 * Playwright route handler, but eth_sendTransaction is answered entirely inside the
 * injected browser script and never touches that route. Without this bridge, a test
 * could click "Stake" and get a success toast, but every subsequent read would still
 * return the pre-transaction values. `page.exposeFunction` (wired up in base.fixture.ts)
 * lets the injected script report submitted transactions back into this same state
 * object, so reads reflect what was actually "sent" — e.g. an approve unlocks the
 * Stake button, a stake increases "Your Stake", a claim empties the withdrawal queue.
 */

import { AMOUNTS, VALIDATORS, TEST_USER } from "../fixtures/test-data"
import type { RewardProof } from "./rpc-responses"

export interface PendingWithdrawal {
  amount: bigint
  claimableAt: bigint
}

export interface MockChainState {
  balance: bigint
  allowance: bigint
  /** validator address (lowercase) -> staked amount */
  stakes: Map<string, bigint>
  /** FIFO queue, oldest first */
  pendingWithdrawals: PendingWithdrawal[]
  merkleDropClaimed: bigint
  /** undefined = no reward proof configured for this address (served as 404) */
  rewardProof?: RewardProof | null
  /** When true, the next eth_sendTransaction simulates the user rejecting the wallet prompt. */
  rejectNextTx: boolean
}

export interface MockChainStateOverrides {
  balance?: bigint
  allowance?: bigint
  stakes?: Record<string, bigint>
  pendingWithdrawals?: PendingWithdrawal[]
  merkleDropClaimed?: bigint
  rewardProof?: RewardProof | null
}

export function createMockChainState(overrides: MockChainStateOverrides = {}): MockChainState {
  const stakes = new Map<string, bigint>([
    [VALIDATORS.validatorA.toLowerCase(), AMOUNTS.userStakeValidatorA],
    [VALIDATORS.validatorB.toLowerCase(), AMOUNTS.userStakeValidatorB],
  ])
  if (overrides.stakes) {
    for (const [validator, amount] of Object.entries(overrides.stakes)) {
      stakes.set(validator.toLowerCase(), amount)
    }
  }

  return {
    balance: overrides.balance ?? AMOUNTS.userBalance,
    allowance: overrides.allowance ?? AMOUNTS.unlimitedAllowance,
    stakes,
    pendingWithdrawals:
      overrides.pendingWithdrawals ??
      [{ amount: AMOUNTS.pendingWithdrawalAmount, claimableAt: BigInt(Math.floor(Date.now() / 1000) - 3600) }],
    merkleDropClaimed: overrides.merkleDropClaimed ?? 0n,
    rewardProof: overrides.rewardProof,
    rejectNextTx: false,
  }
}

/** 4-byte selectors for the write methods the mock provider intercepts. */
export const TX_SELECTORS = {
  approve: "0x095ea7b3",
  stake: "0xadc9772e",
  initiateWithdrawal: "0xc8393ba9",
  claimWithdrawal: "0x6e66d84a",
  claim: "0x1d7d4ebc",
} as const

/** Read one 32-byte ABI word (as hex chars, no 0x) at the given word index of the params section. */
function word(params: string, index: number): string {
  return params.slice(index * 64, index * 64 + 64)
}

function wordToBigInt(params: string, index: number): bigint {
  return BigInt("0x" + (word(params, index) || "0"))
}

function wordToAddress(params: string, index: number): string {
  return "0x" + word(params, index).slice(24)
}

/**
 * Mutate `state` to reflect a submitted transaction, mirroring what the real
 * staking/token/MerkleDrop contracts would do. `data` is the full calldata
 * (selector + ABI-encoded params) as sent via eth_sendTransaction.
 */
export function applyMockTx(state: MockChainState, data: string, userAddress: string = TEST_USER): void {
  const selector = data.slice(0, 10).toLowerCase()
  const params = data.slice(10)

  switch (selector) {
    case TX_SELECTORS.approve: {
      state.allowance = wordToBigInt(params, 1)
      break
    }
    case TX_SELECTORS.stake: {
      const validator = wordToAddress(params, 0).toLowerCase()
      const amount = wordToBigInt(params, 1)
      state.stakes.set(validator, (state.stakes.get(validator) ?? 0n) + amount)
      state.balance -= amount
      break
    }
    case TX_SELECTORS.initiateWithdrawal: {
      const validator = wordToAddress(params, 0).toLowerCase()
      const amount = wordToBigInt(params, 1)
      state.stakes.set(validator, (state.stakes.get(validator) ?? 0n) - amount)
      // Real contract locks the withdrawal for withdrawDelay before it's claimable.
      const claimableAt = BigInt(Math.floor(Date.now() / 1000)) + AMOUNTS.withdrawDelay
      state.pendingWithdrawals.push({ amount, claimableAt })
      break
    }
    case TX_SELECTORS.claimWithdrawal: {
      const claimed = state.pendingWithdrawals.shift()
      if (claimed) state.balance += claimed.amount
      break
    }
    case TX_SELECTORS.claim: {
      const account = wordToAddress(params, 0).toLowerCase()
      if (account !== userAddress.toLowerCase()) break
      const cumulativeAmount = wordToBigInt(params, 1)
      const delta = cumulativeAmount - state.merkleDropClaimed
      if (delta > 0n) {
        state.merkleDropClaimed = cumulativeAmount
        state.balance += delta
      }
      break
    }
    default:
      break
  }
}
