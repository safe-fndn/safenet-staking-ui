import { useMemo, useState, useTransition } from "react"
import { useValidators } from "@/hooks/useValidators"
import { useValidatorTotalStakes } from "@/hooks/useStakingReads"
import { ValidatorCard } from "./ValidatorCard"
import { ValidatorControls, type StatusFilter, type SortOption } from "./ValidatorControls"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw"
import validatorData from "@/data/validators.json"
import type { Address } from "viem"

const metadata = validatorData as Record<string, { label: string; commission: number; uptime: number }>

function getMetadata(address: string) {
  return metadata[address.toLowerCase()] ?? null
}

export function ValidatorList({ autoOpenDelegate }: { autoOpenDelegate?: string }) {
  const { data: validators, isLoading, error, refetch } = useValidators()
  const validatorAddresses = useMemo(() => (validators ?? []).map((v) => v.address), [validators])
  const { data: totalStakesData, isLoading: loadingTotalStakes } = useValidatorTotalStakes(validatorAddresses)
  const totalStakeMap = useMemo(() => {
    const map = new Map<Address, bigint>()
    if (!totalStakesData || !validators) return map
    for (let i = 0; i < validators.length; i++) {
      const result = totalStakesData[i]
      if (result?.status === "success") {
        map.set(validators[i].address, result.result as bigint)
      }
    }
    return map
  }, [totalStakesData, validators])
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("totalStake")
  const [, startTransition] = useTransition()

  const handleSearchChange = (value: string) => {
    startTransition(() => setSearch(value))
  }
  const handleStatusFilterChange = (value: StatusFilter) => {
    startTransition(() => setStatusFilter(value))
  }
  const handleSortChange = (value: SortOption) => {
    startTransition(() => setSortBy(value))
  }

  const filtered = useMemo(() => {
    if (!validators) return []

    let result = [...validators]

    // Status filter
    if (statusFilter === "active") {
      result = result.filter((v) => v.isActive)
    } else if (statusFilter === "inactive") {
      result = result.filter((v) => !v.isActive)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((v) => {
        const meta = getMetadata(v.address)
        return (
          v.address.toLowerCase().includes(q) ||
          (meta && meta.label.toLowerCase().includes(q))
        )
      })
    }

    // Sort
    return result.toSorted((a, b) => {
      const metaA = getMetadata(a.address)
      const metaB = getMetadata(b.address)

      if (sortBy === "commission") {
        return (metaA?.commission ?? 100) - (metaB?.commission ?? 100)
      }
      if (sortBy === "uptime") {
        return (metaB?.uptime ?? 0) - (metaA?.uptime ?? 0)
      }
      // totalStake — active first is the default from the hook, keep that
      return a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1
    })
  }, [validators, search, statusFilter, sortBy])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ValidatorControls
          search={search}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
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
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
