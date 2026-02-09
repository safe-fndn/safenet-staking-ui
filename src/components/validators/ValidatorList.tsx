import { useMemo, useState } from "react"
import { useValidators } from "@/hooks/useValidators"
import { ValidatorCard } from "./ValidatorCard"
import { ValidatorControls, type StatusFilter, type SortOption } from "./ValidatorControls"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import validatorData from "@/data/validators.json"

const metadata = validatorData as Record<string, { label: string; commission: number; uptime: number }>

function getMetadata(address: string) {
  return metadata[address.toLowerCase()] ?? null
}

export function ValidatorList({ autoOpenDelegate }: { autoOpenDelegate?: string }) {
  const { data: validators, isLoading, error, refetch } = useValidators()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("totalStake")

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
    result.sort((a, b) => {
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

    return result
  }, [validators, search, statusFilter, sortBy])

  if (isLoading) {
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
          <RefreshCw className="h-4 w-4 mr-2" />
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
