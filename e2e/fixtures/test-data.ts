/** Contract addresses on Sepolia */
export const STAKING_CONTRACT = "0x6E4D214A7FA04be157b1Aae498b395bd21Da0aF5".toLowerCase()
export const TOKEN_CONTRACT = "0xef98bcc90b1373b2ae0d23ec318d3ee70ea61af4".toLowerCase()
export const MERKLE_DROP_CONTRACT = "0x3333333333333333333333333333333333333333".toLowerCase()

/** Test user address (has active stakes on Gnosis + Greenfield) */
export const TEST_USER = "0x1111111111111111111111111111111111111111"

/** Test user address with no active stake on any validator */
export const NO_STAKE_USER = "0x2222222222222222222222222222222222222222"

/** Validator addresses — must match the "Gnosis"/"Greenfield" entries in the
 * live validator-info.json fetched by useValidators() during e2e runs. */
export const VALIDATORS = {
  gnosis: "0x3D58a5475c1336b0A755c3aBd298CeB9b7BB9CDe",
  greenfield: "0x7B0A8EFA45dE81F11F2846EC28259B62155a2b37",
} as const

/** Sepolia chain ID */
export const CHAIN_ID = 11155111
export const CHAIN_ID_HEX = "0xaa36a7"

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
  /** User stake on Gnosis: 300 SAFE */
  userStakeGnosis: 300n * 10n ** 18n,
  /** User stake on Greenfield: 200 SAFE */
  userStakeGreenfield: 200n * 10n ** 18n,
  /** Total staked across all: 10000 SAFE */
  totalStaked: 10_000n * 10n ** 18n,
  /** Gnosis total validator stake: 5000 SAFE */
  gnosisTotalStake: 5_000n * 10n ** 18n,
  /** Greenfield total validator stake: 5000 SAFE */
  greenfieldTotalStake: 5_000n * 10n ** 18n,
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

/** Mock EIP-5792 batch call id */
export const MOCK_BATCH_ID = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

/** Merkle drop rewards fixtures — 100 SAFE claimable, nothing claimed yet */
export const MOCK_MERKLE_ROOT = "0x" + "1".repeat(64)
export const MOCK_CUMULATIVE_AMOUNT = 100n * 10n ** 18n
export const MOCK_REWARD_PROOF = {
  cumulativeAmount: MOCK_CUMULATIVE_AMOUNT.toString(),
  merkleRoot: MOCK_MERKLE_ROOT,
  proof: ["0x" + "2".repeat(64)],
}

/** Gas estimation values */
export const GAS = {
  estimateGas: "0x30d40", // 200000
  gasPrice: "0x3b9aca00", // 1 gwei
} as const
