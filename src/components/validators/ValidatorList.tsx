import { useMemo } from "react"
import { useValidators } from "@/hooks/useValidators"
import {
  useValidatorTotalStakes,
  useUserStakesOnValidators,
} from "@/hooks/useStakingReads"
import { ValidatorCard } from "./ValidatorCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw"
import type { Address } from "viem"

export function ValidatorList({
  autoOpenDelegate,
}: {
  autoOpenDelegate?: string
}) {
  const { data: validators, isLoading, error, refetch } = useValidators()
  const validatorAddresses = useMemo(
    () => (validators ?? []).map((v) => v.address),
    [validators],
  )
  const { data: totalStakesData, isLoading: loadingTotalStakes } =
    useValidatorTotalStakes(validatorAddresses)
  const { data: userStakesData, isLoading: loadingUserStakes } =
    useUserStakesOnValidators(validatorAddresses)
  const totalStakeMap = useMemo(() => {
    const map = new Map<Address, bigint>()
    if (!totalStakesData || !validators) return map
    for (let i = 0; i < validators.length; i++) {
      const result = totalStakesData[i]
      if (result?.status === "success" && typeof result.result === "bigint") {
        map.set(validators[i].address, result.result)
      }
    }
    return map
  }, [totalStakesData, validators])
  const userStakeMap = useMemo(() => {
    const map = new Map<Address, bigint>()
    if (!userStakesData || !validators) return map
    for (let i = 0; i < validators.length; i++) {
      const result = userStakesData[i]
      if (result?.status === "success" && typeof result.result === "bigint") {
        map.set(validators[i].address, result.result)
      }
    }
    return map
  }, [userStakesData, validators])

  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load validators: {error.message}
      </div>
    )
  }

  if (!validators || validators.length === 0) {
    return (
      <div className="border p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          No validators are currently available.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {validators.map((v) => (
        <ValidatorCard
          key={v.address}
          validator={v.address}
          isActive={v.isActive}
          autoOpenDelegate={
            autoOpenDelegate?.toLowerCase() === v.address.toLowerCase()
          }
          totalStake={totalStakeMap.get(v.address)}
          loadingTotalStake={loadingTotalStakes}
          userStake={userStakeMap.get(v.address)}
          loadingUserStake={loadingUserStakes}
          validators={validators}
        />
      ))}
    </div>
  )
}
