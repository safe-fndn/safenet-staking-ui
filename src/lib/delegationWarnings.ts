import type { Address } from "viem"
import type { ValidatorInfo } from "@/hooks/useValidators"

/** Validators (and their delegators) earn no rewards for a period with participation below this percentage. */
export const LOW_PARTICIPATION_THRESHOLD = 75

export const INACTIVE_WARNING = "You have delegated to an inactive validator. Please review your stake."

export const LOW_PARTICIPATION_WARNING =
  "You have delegated to a validator with participation below 75%. Please review your stake."

export interface DelegationWarnings {
  inactive: ValidatorInfo[]
  lowParticipation: ValidatorInfo[]
}

/** Exactly 75% is not considered low. */
export function isLowParticipation(validator: ValidatorInfo): boolean {
  return validator.participationRate < LOW_PARTICIPATION_THRESHOLD
}

/**
 * Collects the validators the user has stake on that are inactive and/or have low
 * participation. The two conditions are checked independently, so a validator can
 * appear in both lists.
 */
export function getDelegationWarnings(
  validators: ValidatorInfo[],
  stakeOf: (validator: Address) => bigint | undefined,
): DelegationWarnings {
  const warnings: DelegationWarnings = { inactive: [], lowParticipation: [] }
  for (const v of validators) {
    const stake = stakeOf(v.address)
    if (stake === undefined || stake <= 0n) continue
    if (!v.isActive) warnings.inactive.push(v)
    if (isLowParticipation(v)) warnings.lowParticipation.push(v)
  }
  return warnings
}
