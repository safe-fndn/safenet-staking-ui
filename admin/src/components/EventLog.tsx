import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useContractEvents } from "@/hooks/useContractEvents"
import { truncateAddress } from "@/lib/format"
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw"

const EVENT_COLORS: Record<string, string> = {
  StakeIncreased: "bg-green-600",
  WithdrawalInitiated: "bg-yellow-600",
  WithdrawalClaimed: "bg-blue-600",
  ValidatorUpdated: "bg-purple-600",
  WithdrawDelayProposed: "bg-orange-600",
  ValidatorsProposed: "bg-orange-600",
  WithdrawDelayChanged: "bg-teal-600",
  TokensRecovered: "bg-red-600",
  OwnershipTransferred: "bg-pink-600",
}

export function EventLog() {
  const [limit, setLimit] = useState(25)
  const { data: events, isLoading, error, refetch, isFetching } = useContractEvents(limit)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Event Log</CardTitle>
            <CardDescription>Recent contract events (decoded)</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load events: {(error as Error).message?.slice(0, 200)}
          </div>
        ) : !events || events.length === 0 ? (
          <div className="rounded-lg border p-8 text-center text-muted-foreground">
            No events found.
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, i) => (
              <div key={`${event.transactionHash}-${i}`} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${EVENT_COLORS[event.name] ?? "bg-gray-600"} text-white hover:opacity-80`}>
                      {event.name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Block {event.blockNumber.toString()}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {truncateAddress(event.transactionHash)}
                  </span>
                </div>
                <div className="grid gap-1">
                  {Object.entries(event.args).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-xs">
                      <span className="text-muted-foreground font-medium min-w-[120px]">{key}:</span>
                      <span className="font-mono break-all">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {events.length >= limit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setLimit((l) => l + 25)}
              >
                Load More
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
