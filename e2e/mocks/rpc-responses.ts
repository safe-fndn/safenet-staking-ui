/**
 * ABI-encoded return values for contract read calls.
 * Values are pre-encoded to avoid importing viem in the mock layer.
 *
 * Encoding: abi.encode for each return type, padded to 32 bytes.
 */

import { AMOUNTS, STAKING_CONTRACT, TOKEN_CONTRACT, VALIDATORS, TEST_USER } from "../fixtures/test-data"

/** Pad a bigint to a 32-byte hex string (no 0x prefix) */
function toUint256(value: bigint): string {
  return value.toString(16).padStart(64, "0")
}

/** Pad an address to 32 bytes (no 0x prefix) */
function toAddress(addr: string): string {
  return addr.replace("0x", "").toLowerCase().padStart(64, "0")
}

/** Encode a bool */
function toBool(value: boolean): string {
  return value ? toUint256(1n) : toUint256(0n)
}

/**
 * 4-byte function selectors computed from the ABI signatures.
 * keccak256("functionName(types)").slice(0,10)
 */
export const SELECTORS = {
  // Staking contract reads
  totalStakedAmount: "0x567e98f9",
  totalPendingWithdrawals: "0xa4563e03",
  withdrawDelay: "0x0288a39c",
  nextWithdrawalId: "0x4a9122e3",
  isValidator: "0xfacd743b",
  totalValidatorStakes: "0x53e274cd",
  stakes: "0xa4e47b66",
  totalStakerStakes: "0x42007deb",
  withdrawalQueues: "0x86fa9442",
  getPendingWithdrawals: "0xf340c0d0",
  getNextClaimableWithdrawal: "0xb870e6c8",
  // Token contract reads
  balanceOf: "0x70a08231",
  allowance: "0xdd62ed3e",
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
} as const

/**
 * Build a map of (contractAddress + selector) → response for eth_call.
 * This handles the multicall batching by matching on the data prefix.
 */
export function buildCallResponses(userAddress?: string): Map<string, (data: string) => string> {
  const responses = new Map<string, (data: string) => string>()
  const user = (userAddress || TEST_USER).toLowerCase()
  const staking = STAKING_CONTRACT
  const token = TOKEN_CONTRACT

  // Helper: create a response key from contract + selector
  function key(contract: string, selector: string): string {
    return `${contract.toLowerCase()}:${selector.toLowerCase()}`
  }

  // Staking: totalStakedAmount() → uint256
  responses.set(key(staking, SELECTORS.totalStakedAmount), () =>
    "0x" + toUint256(AMOUNTS.totalStaked)
  )

  // Staking: totalPendingWithdrawals() → uint256
  responses.set(key(staking, SELECTORS.totalPendingWithdrawals), () =>
    "0x" + toUint256(AMOUNTS.totalPendingWithdrawals)
  )

  // Staking: withdrawDelay() → uint128
  responses.set(key(staking, SELECTORS.withdrawDelay), () =>
    "0x" + toUint256(AMOUNTS.withdrawDelay)
  )

  // Staking: nextWithdrawalId() → uint64
  responses.set(key(staking, SELECTORS.nextWithdrawalId), () =>
    "0x" + toUint256(2n)
  )

  // Staking: isValidator(address) → bool
  responses.set(key(staking, SELECTORS.isValidator), (data: string) => {
    const addrParam = "0x" + data.slice(10, 74).replace(/^0+/, "")
    const isVal = addrParam.toLowerCase() === VALIDATORS.gnosis.toLowerCase() ||
                  addrParam.toLowerCase() === VALIDATORS.greenfield.toLowerCase()
    return "0x" + toBool(isVal)
  })

  // Staking: totalValidatorStakes(address) → uint256
  responses.set(key(staking, SELECTORS.totalValidatorStakes), (data: string) => {
    const addrParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (addrParam === VALIDATORS.gnosis.toLowerCase()) {
      return "0x" + toUint256(AMOUNTS.gnosisTotalStake)
    }
    if (addrParam === VALIDATORS.greenfield.toLowerCase()) {
      return "0x" + toUint256(AMOUNTS.greenfieldTotalStake)
    }
    return "0x" + toUint256(0n)
  })

  // Staking: stakes(address staker, address validator) → uint256
  responses.set(key(staking, SELECTORS.stakes), (data: string) => {
    const stakerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    const validatorParam = "0x" + data.slice(74, 138).replace(/^0+/, "").toLowerCase()
    if (stakerParam === user) {
      if (validatorParam === VALIDATORS.gnosis.toLowerCase()) {
        return "0x" + toUint256(AMOUNTS.userStakeGnosis)
      }
      if (validatorParam === VALIDATORS.greenfield.toLowerCase()) {
        return "0x" + toUint256(AMOUNTS.userStakeGreenfield)
      }
    }
    return "0x" + toUint256(0n)
  })

  // Staking: totalStakerStakes(address) → uint256
  responses.set(key(staking, SELECTORS.totalStakerStakes), (data: string) => {
    const stakerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (stakerParam === user) {
      return "0x" + toUint256(AMOUNTS.userTotalStake)
    }
    return "0x" + toUint256(0n)
  })

  // Staking: withdrawalQueues(address) → (uint64 head, uint64 tail)
  responses.set(key(staking, SELECTORS.withdrawalQueues), () =>
    "0x" + toUint256(0n) + toUint256(1n)
  )

  // Staking: getPendingWithdrawals(address) → (amount, claimableAt)[]
  responses.set(key(staking, SELECTORS.getPendingWithdrawals), (data: string) => {
    const stakerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (stakerParam === user) {
      // Return one pending withdrawal: 50 SAFE, claimable at timestamp in the past (ready to claim)
      const claimableAt = BigInt(Math.floor(Date.now() / 1000) - 3600) // 1 hour ago
      // ABI encoding for dynamic array of tuples:
      // offset to array data (32), array length (1), amount, claimableAt
      return "0x" +
        toUint256(32n) + // offset
        toUint256(1n) + // length
        toUint256(AMOUNTS.pendingWithdrawalAmount) +
        toUint256(claimableAt)
    }
    return "0x" + toUint256(32n) + toUint256(0n) // empty array
  })

  // Staking: getNextClaimableWithdrawal(address) → (uint256 amount, uint256 claimableAt)
  responses.set(key(staking, SELECTORS.getNextClaimableWithdrawal), (data: string) => {
    const stakerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (stakerParam === user) {
      const claimableAt = BigInt(Math.floor(Date.now() / 1000) - 3600)
      return "0x" + toUint256(AMOUNTS.pendingWithdrawalAmount) + toUint256(claimableAt)
    }
    return "0x" + toUint256(0n) + toUint256(0n)
  })

  // Token: balanceOf(address) → uint256
  responses.set(key(token, SELECTORS.balanceOf), (data: string) => {
    const ownerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (ownerParam === user) {
      return "0x" + toUint256(AMOUNTS.userBalance)
    }
    return "0x" + toUint256(0n)
  })

  // Token: allowance(owner, spender) → uint256
  responses.set(key(token, SELECTORS.allowance), (data: string) => {
    const ownerParam = "0x" + data.slice(10, 74).replace(/^0+/, "").toLowerCase()
    if (ownerParam === user) {
      return "0x" + toUint256(AMOUNTS.unlimitedAllowance)
    }
    return "0x" + toUint256(0n)
  })

  // Token: name() → string "Safe Token"
  responses.set(key(token, SELECTORS.name), () => {
    // ABI-encode string "Safe Token"
    const str = "Safe Token"
    const hex = Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    return "0x" + toUint256(32n) + toUint256(BigInt(str.length)) + hex.padEnd(64, "0")
  })

  // Token: symbol() → string "SAFE"
  responses.set(key(token, SELECTORS.symbol), () => {
    const str = "SAFE"
    const hex = Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    return "0x" + toUint256(32n) + toUint256(BigInt(str.length)) + hex.padEnd(64, "0")
  })

  // Token: decimals() → uint8
  responses.set(key(token, SELECTORS.decimals), () =>
    "0x" + toUint256(18n)
  )

  return responses
}

// Re-export for convenience
export { toUint256, toAddress, toBool }
