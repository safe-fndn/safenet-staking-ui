// TODO: Integrate with Merkle drop contract when available
// This is a placeholder hook returning mock data

export interface RewardsData {
  claimable: bigint
  weeklyCapUsed: number
  weeklyCapTotal: number
  expiresAt: number
  canClaim: boolean
}

export function useRewards(): { data: RewardsData; isLoading: false } {
  return {
    data: {
      claimable: 0n,
      weeklyCapUsed: 0,
      weeklyCapTotal: 500,
      expiresAt: 0,
      canClaim: false,
    },
    isLoading: false,
  }
}
