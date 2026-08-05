/** Contract addresses on Sepolia */
export const STAKING_CONTRACT = "0x40745eec3fD6E4C005de1dec0031b2EA9f9D7c42".toLowerCase()
export const TOKEN_CONTRACT = "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4".toLowerCase()
/** Mock MerkleDrop contract address (set via VITE_MERKLE_DROP_ADDRESS in playwright.config.ts) */
export const MERKLE_DROP_CONTRACT = "0x9999999999999999999999999999999999999999".toLowerCase()

/** Test user address */
export const TEST_USER = "0x1111111111111111111111111111111111111111"

/** Validator addresses */
export const VALIDATORS = {
  validatorA: "0x1234567890abcdef1234567890abcdef12345678",
  validatorB: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
} as const

/** Sepolia chain ID */
export const CHAIN_ID = 11155111
export const CHAIN_ID_HEX = "0xaa36a7"

/** Mainnet chain ID, used to simulate a wallet connected to the wrong network */
export const WRONG_CHAIN_ID_HEX = "0x1"

/** Mock block number */
export const BLOCK_NUMBER = "0x6000000"

/** Mock deploy block */
export const DEPLOY_BLOCK = 5_000_000n

/** Mock token amounts (18 decimals) */
export const AMOUNTS = {
  /** User SAFE balance: 1000 SAFE */
  userBalance: 1000n * 10n ** 18n,
  /** User total staked: 500 SAFE */
  userTotalStake: 500n * 10n ** 18n,
  /** User stake on Validator A: 300 SAFE */
  userStakeValidatorA: 300n * 10n ** 18n,
  /** User stake on Validator B: 200 SAFE */
  userStakeValidatorB: 200n * 10n ** 18n,
  /** Total staked across all: 10000 SAFE */
  totalStaked: 10_000n * 10n ** 18n,
  /** Validator A total stake: 5000 SAFE */
  validatorATotalStake: 5_000n * 10n ** 18n,
  /** Validator B total stake: 5000 SAFE */
  validatorBTotalStake: 5_000n * 10n ** 18n,
  /** Total pending withdrawals: 100 SAFE */
  totalPendingWithdrawals: 100n * 10n ** 18n,
  /** Unlimited allowance */
  unlimitedAllowance: 2n ** 256n - 1n,
  /** Withdraw delay: 7 days in seconds */
  withdrawDelay: 604800n,
  /** Pending withdrawal amount: 50 SAFE */
  pendingWithdrawalAmount: 50n * 10n ** 18n,
} as const

/** Mock transaction hash */
export const MOCK_TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

/** MerkleDrop root reported on-chain by the mock RPC (merkleRoot()) */
export const TEST_MERKLE_ROOT = "0x" + "ab".repeat(32)

/** Sample reward proofs (matching public/rewards/proofs/{address}.json format) for rewards.spec.ts */
export const REWARD_PROOFS = {
  /** cumulativeAmount (100 SAFE) > claimed (0) → claimable, canClaim: true */
  claimable: {
    cumulativeAmount: (100n * 10n ** 18n).toString(),
    merkleRoot: TEST_MERKLE_ROOT,
    proof: ["0x" + "11".repeat(32)],
  },
  /** cumulativeAmount equals what the test sets as already-claimed → claimable: 0, disabled */
  fullyClaimed: {
    cumulativeAmount: (50n * 10n ** 18n).toString(),
    merkleRoot: TEST_MERKLE_ROOT,
    proof: ["0x" + "11".repeat(32)],
  },
  /** proof's embedded root doesn't match the mocked on-chain root → rootStale, disabled */
  staleRoot: {
    cumulativeAmount: (100n * 10n ** 18n).toString(),
    merkleRoot: "0x" + "cc".repeat(32),
    proof: ["0x" + "11".repeat(32)],
  },
  /** part of the claimable amount is pending compliance review (kyc !== true) */
  partialKyc: {
    cumulativeAmount: (100n * 10n ** 18n).toString(),
    merkleRoot: TEST_MERKLE_ROOT,
    proof: ["0x" + "11".repeat(32)],
    kycAmount: (50n * 10n ** 18n).toString(),
    kyc: false,
  },
}

/** Gas estimation values */
export const GAS = {
  estimateGas: "0x30d40", // 200000
  gasPrice: "0x3b9aca00", // 1 gwei
} as const
