import { useValidators } from "@/hooks/useValidators"
import { ValidatorCard } from "./ValidatorCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export function ValidatorList() {
  const { data: validators, isLoading, error, refetch } = useValidators()

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {validators.map((v) => (
        <ValidatorCard key={v.address} validator={v.address} isActive={v.isActive} />
      ))}
    </div>
  )
}
