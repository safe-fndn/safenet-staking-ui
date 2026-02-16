import type { Address, Hash } from "viem"

export const TEST_ACCOUNTS = {
  user: "0x1111111111111111111111111111111111111111" as Address,
  validator1: "0x1234567890abcdef1234567890abcdef12345678" as Address,
  validator2: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
} as const

export const TEST_CONTRACTS = {
  staking: "0x6E4D214A7FA04be157b1Aae498b395bd21Da0aF5" as Address,
  token: "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4" as Address,
} as const

export const CHAIN_ID = 11155111

export const AMOUNTS = {
  userBalance: 1000n * 10n ** 18n,
  userTotalStake: 500n * 10n ** 18n,
  userStakeValidator1: 300n * 10n ** 18n,
  userStakeValidator2: 200n * 10n ** 18n,
  totalStaked: 10_000n * 10n ** 18n,
  totalPendingWithdrawals: 100n * 10n ** 18n,
  unlimitedAllowance: 2n ** 256n - 1n,
  withdrawDelay: 604800n,
  pendingWithdrawalAmount: 50n * 10n ** 18n,
  zero: 0n,
} as const

export const MOCK_TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hash
