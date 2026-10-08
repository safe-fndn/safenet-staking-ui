import { describe, it, expect } from "vitest"
import type { Address } from "viem"
import { getDelegationWarnings, isLowParticipation } from "../delegationWarnings"
import type { ValidatorInfo } from "@/hooks/useValidators"
import { TEST_ACCOUNTS } from "@/__tests__/test-data"

const STAKE = 100n * 10n ** 18n

function validator(address: Address, overrides: Partial<ValidatorInfo> = {}): ValidatorInfo {
  return { address, isActive: true, label: "V", commission: 5, participationRate: 99, ...overrides }
}

function stakeOnAll(amount: bigint | undefined) {
  return () => amount
}

describe("isLowParticipation", () => {
  it("does not flag exactly 75%", () => {
    expect(isLowParticipation(validator(TEST_ACCOUNTS.validator1, { participationRate: 75 }))).toBe(false)
  })

  it("flags anything below 75%", () => {
    expect(isLowParticipation(validator(TEST_ACCOUNTS.validator1, { participationRate: 74.99 }))).toBe(true)
  })
})

describe("getDelegationWarnings", () => {
  it("reports an inactive validator only as inactive", () => {
    const v = validator(TEST_ACCOUNTS.validator1, { isActive: false })
    expect(getDelegationWarnings([v], stakeOnAll(STAKE))).toEqual({ inactive: [v], lowParticipation: [] })
  })

  it("reports a low participation validator only as low participation", () => {
    const v = validator(TEST_ACCOUNTS.validator1, { participationRate: 60 })
    expect(getDelegationWarnings([v], stakeOnAll(STAKE))).toEqual({ inactive: [], lowParticipation: [v] })
  })

  it("reports both conditions for the same validator", () => {
    const v = validator(TEST_ACCOUNTS.validator1, { isActive: false, participationRate: 50 })
    expect(getDelegationWarnings([v], stakeOnAll(STAKE))).toEqual({ inactive: [v], lowParticipation: [v] })
  })

  it("reports both conditions across different validators", () => {
    const inactive = validator(TEST_ACCOUNTS.validator1, { isActive: false })
    const low = validator(TEST_ACCOUNTS.validator2, { participationRate: 60 })
    expect(getDelegationWarnings([inactive, low], stakeOnAll(STAKE))).toEqual({
      inactive: [inactive],
      lowParticipation: [low],
    })
  })

  it("does not warn at exactly 75% participation", () => {
    const v = validator(TEST_ACCOUNTS.validator1, { participationRate: 75 })
    expect(getDelegationWarnings([v], stakeOnAll(STAKE))).toEqual({ inactive: [], lowParticipation: [] })
  })

  it("ignores affected validators the user has no stake on", () => {
    const inactive = validator(TEST_ACCOUNTS.validator1, { isActive: false, participationRate: 10 })
    const low = validator(TEST_ACCOUNTS.validator2, { participationRate: 10 })
    const stakes = new Map<Address, bigint>([[TEST_ACCOUNTS.validator1, 0n]])
    expect(getDelegationWarnings([inactive, low], (a) => stakes.get(a))).toEqual({
      inactive: [],
      lowParticipation: [],
    })
  })

  it("only reports affected validators among those with stake", () => {
    const healthy = validator(TEST_ACCOUNTS.validator1)
    const low = validator(TEST_ACCOUNTS.validator2, { participationRate: 60 })
    const stakes = new Map<Address, bigint>([[TEST_ACCOUNTS.validator1, STAKE]])
    expect(getDelegationWarnings([healthy, low], (a) => stakes.get(a))).toEqual({
      inactive: [],
      lowParticipation: [],
    })
  })
})
