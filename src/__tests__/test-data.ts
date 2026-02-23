import type { Address, Hash } from "viem"

export const TEST_ACCOUNTS = {
  user: "0x1111111111111111111111111111111111111111" as Address,
  validator1: "0x1234567890abcdef1234567890abcdef12345678" as Address,
  validator2: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
} as const

export const AMOUNTS = {
  userBalance: 1000n * 10n ** 18n,
  userStakeValidator1: 300n * 10n ** 18n,
  unlimitedAllowance: 2n ** 256n - 1n,
  withdrawDelay: 604800n,
  pendingWithdrawalAmount: 50n * 10n ** 18n,
} as const

export const MOCK_TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hash

/** Pending withdrawal fixture (cooldown not yet expired) */
export const MOCK_WITHDRAWAL_PENDING = {
  amount: 50n * 10n ** 18n,
  claimableAt: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
}

/** Claimable withdrawal fixture (cooldown expired) */
export const MOCK_WITHDRAWAL_CLAIMABLE = {
  amount: 100n * 10n ** 18n,
  claimableAt: BigInt(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
}

/** Validator info fixtures matching useValidators return type */
export const MOCK_VALIDATORS = [
  { address: TEST_ACCOUNTS.validator1, isActive: true, label: "Gnosis", commission: 5, participationRate: 99.9 },
  { address: TEST_ACCOUNTS.validator2, isActive: true, label: "Greenfield", commission: 4, participationRate: 99.7 },
] as const
