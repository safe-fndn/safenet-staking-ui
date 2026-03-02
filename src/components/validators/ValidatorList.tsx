import { useMemo, useState, useTransition } from "react"
import { useValidators } from "@/hooks/useValidators"
import {
  useValidatorTotalStakes,
  useUserStakesOnValidators,
} from "@/hooks/useStakingReads"
import { ValidatorCard } from "./ValidatorCard"
import { ValidatorControls } from "./ValidatorControls"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw"
import type { Address } from "viem"

export function ValidatorList({ autoOpenDelegate }: { autoOpenDelegate?: string }) {
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
  const [search, setSearch] = useState("")
  const [, startTransition] = useTransition()

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearch(value))
  }

  const filtered = useMemo(() => {
    if (!validators) return []

    if (!search.trim()) return validators

    const q = search.toLowerCase()
    return validators.filter((v) =>
      v.address.toLowerCase().includes(q) ||
      v.label.toLowerCase().includes(q)
    )
  }, [validators, search])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ValidatorControls
          search={search}
          onSearchChange={handleSearchChange}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load validators: {error.message}
      </div>
    )
  }

  if (!validators || validators.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center space-y-4">
        <p className="text-muted-foreground">
          No validators are currently available. Delegation is temporarily unavailable.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ValidatorControls
        search={search}
        onSearchChange={setSearch}
      />
      {filtered.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No validators match your search criteria.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <ValidatorCard
              key={v.address}
              validator={v.address}
              isActive={v.isActive}
              autoOpenDelegate={autoOpenDelegate?.toLowerCase() === v.address.toLowerCase()}
              totalStake={totalStakeMap.get(v.address)}
              loadingTotalStake={loadingTotalStakes}
              userStake={userStakeMap.get(v.address)}
              loadingUserStake={loadingUserStakes}
              validators={validators}
            />
          ))}
        </div>
      )}
    </div>
  )
}
