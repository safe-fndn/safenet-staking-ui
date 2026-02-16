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
