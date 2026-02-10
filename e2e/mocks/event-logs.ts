/**
 * Mock eth_getLogs responses for validator discovery and transaction history.
 */

import { STAKING_CONTRACT, VALIDATORS, TEST_USER, AMOUNTS } from "../fixtures/test-data"
import { toUint256, toAddress } from "./rpc-responses"

// Event topic hashes (keccak256 of event signatures)
const TOPICS = {
  ValidatorUpdated: "0x763b63b30e91c843bb39e4379603697003d3b7c1f192619cd782fa33bdc44396",
  StakeIncreased: "0x835b6b05d09416215e9d638808ff68a75b79bb61e485812125e29950d722de5e",
  WithdrawalInitiated: "0xe77a460de02956e5b769dc1b86f3dedb6471a5a1480b18e5e60c025d3842a134",
  WithdrawalClaimed: "0x6ee1930b1249317355da0ca051522261bf0c5287979ae2907223ac0a03017ba6",
} as const

/** Pad address to topic format (32 bytes, 0x-prefixed) */
function addrTopic(addr: string): string {
  return "0x" + toAddress(addr)
}

/**
 * Generate mock ValidatorUpdated event logs.
 */
export function getValidatorUpdatedLogs(): object[] {
  return [
    {
      address: "0x" + STAKING_CONTRACT.replace("0x", ""),
      topics: [
        TOPICS.ValidatorUpdated,
        addrTopic(VALIDATORS.gnosis),
      ],
      data: "0x" + toUint256(1n), // isRegistered = true
      blockNumber: "0x4c4b40", // 5000000
      blockHash: "0x" + "b".repeat(64),
      transactionHash: "0x" + "c".repeat(64),
      transactionIndex: "0x0",
      logIndex: "0x0",
      removed: false,
    },
    {
      address: "0x" + STAKING_CONTRACT.replace("0x", ""),
      topics: [
        TOPICS.ValidatorUpdated,
        addrTopic(VALIDATORS.greenfield),
      ],
      data: "0x" + toUint256(1n), // isRegistered = true
      blockNumber: "0x4c4b41",
      blockHash: "0x" + "d".repeat(64),
      transactionHash: "0x" + "e".repeat(64),
      transactionIndex: "0x0",
      logIndex: "0x0",
      removed: false,
    },
  ]
}

/**
 * Generate mock StakeIncreased logs for the test user.
 */
export function getStakeIncreasedLogs(): object[] {
  return [
    {
      address: "0x" + STAKING_CONTRACT.replace("0x", ""),
      topics: [
        TOPICS.StakeIncreased,
        addrTopic(TEST_USER),
        addrTopic(VALIDATORS.gnosis),
      ],
      data: "0x" + toUint256(AMOUNTS.userStakeGnosis),
      blockNumber: "0x5000001",
      blockHash: "0x" + "f1".repeat(32),
      transactionHash: "0x" + "a1".repeat(32),
      transactionIndex: "0x0",
      logIndex: "0x0",
      removed: false,
    },
    {
      address: "0x" + STAKING_CONTRACT.replace("0x", ""),
      topics: [
        TOPICS.StakeIncreased,
        addrTopic(TEST_USER),
        addrTopic(VALIDATORS.greenfield),
      ],
      data: "0x" + toUint256(AMOUNTS.userStakeGreenfield),
      blockNumber: "0x5000002",
      blockHash: "0x" + "f2".repeat(32),
      transactionHash: "0x" + "a2".repeat(32),
      transactionIndex: "0x0",
      logIndex: "0x0",
      removed: false,
    },
  ]
}

/**
 * Generate mock WithdrawalInitiated logs for the test user.
 */
export function getWithdrawalInitiatedLogs(): object[] {
  return [
    {
      address: "0x" + STAKING_CONTRACT.replace("0x", ""),
      topics: [
        TOPICS.WithdrawalInitiated,
        addrTopic(TEST_USER),
        addrTopic(VALIDATORS.gnosis),
        "0x" + toUint256(1n), // withdrawalId
      ],
      data: "0x" + toUint256(AMOUNTS.pendingWithdrawalAmount),
      blockNumber: "0x5000003",
      blockHash: "0x" + "f3".repeat(32),
      transactionHash: "0x" + "a3".repeat(32),
      transactionIndex: "0x0",
      logIndex: "0x0",
      removed: false,
    },
  ]
}

/**
 * Generate mock WithdrawalClaimed logs for the test user.
 */
export function getWithdrawalClaimedLogs(): object[] {
  return []
}

/**
 * Match a getLogs request against our mock data.
 * Returns the appropriate logs based on the topics filter.
 */
export function matchGetLogs(params: {
  address?: string
  topics?: (string | string[] | null)[]
}): object[] {
  const address = params.address?.toLowerCase()
  const stakingAddr = STAKING_CONTRACT.toLowerCase()

  if (address && address !== stakingAddr) return []

  const topics = params.topics || []
  const eventTopic = topics[0]

  if (!eventTopic) {
    // No topic filter — return all
    return [
      ...getValidatorUpdatedLogs(),
      ...getStakeIncreasedLogs(),
      ...getWithdrawalInitiatedLogs(),
      ...getWithdrawalClaimedLogs(),
    ]
  }

  // Handle case where eventTopic is a string or array
  const topicStr = Array.isArray(eventTopic) ? eventTopic[0] : eventTopic

  switch (topicStr) {
    case TOPICS.ValidatorUpdated:
      return getValidatorUpdatedLogs()
    case TOPICS.StakeIncreased: {
      let logs = getStakeIncreasedLogs()
      // Filter by staker (topic1) if specified
      if (topics[1]) {
        const staker = (Array.isArray(topics[1]) ? topics[1][0] : topics[1]).toLowerCase()
        logs = logs.filter(l => (l as { topics: string[] }).topics[1].toLowerCase() === staker)
      }
      // Filter by validator (topic2) if specified
      if (topics[2]) {
        const validator = (Array.isArray(topics[2]) ? topics[2][0] : topics[2]).toLowerCase()
        logs = logs.filter(l => (l as { topics: string[] }).topics[2].toLowerCase() === validator)
      }
      return logs
    }
    case TOPICS.WithdrawalInitiated: {
      let logs = getWithdrawalInitiatedLogs()
      if (topics[1]) {
        const staker = (Array.isArray(topics[1]) ? topics[1][0] : topics[1]).toLowerCase()
        logs = logs.filter(l => (l as { topics: string[] }).topics[1].toLowerCase() === staker)
      }
      return logs
    }
    case TOPICS.WithdrawalClaimed:
      return getWithdrawalClaimedLogs()
    default:
      return []
  }
}
