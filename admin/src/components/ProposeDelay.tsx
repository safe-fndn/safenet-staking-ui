import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useConfigTimeDelay, useWithdrawDelay } from "@/hooks/useAdminReads"
import { useProposeWithdrawDelay } from "@/hooks/useAdminWrites"
import { useToast } from "@/hooks/useToast"
import { formatCountdown } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2 } from "lucide-react"

export function ProposeDelay() {
  const [delaySeconds, setDelaySeconds] = useState("")
  const { proposeWithdrawDelay, isPending, isSuccess, error, reset, txHash } = useProposeWithdrawDelay()
  const { data: configTimeDelay } = useConfigTimeDelay()
  const { data: currentDelay } = useWithdrawDelay()
  const { toast } = useToast()

  const maxDelay = configTimeDelay !== undefined ? Number(configTimeDelay as bigint) : null

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Delay proposal submitted", description: `Proposed new delay: ${delaySeconds}s`, txHash: txHash! })
      setDelaySeconds("")
      reset()
    }
  }, [isSuccess, reset, toast, delaySeconds, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Proposal failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const parsedDelay = delaySeconds ? BigInt(delaySeconds) : 0n
  const exceedsMax = maxDelay !== null && parsedDelay > BigInt(maxDelay)
  const canSubmit = parsedDelay > 0n && !exceedsMax && !isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Propose Withdraw Delay</CardTitle>
        <CardDescription>
          Propose a new withdrawal delay (in seconds). The change is subject to the config time delay before it can be executed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">New Delay (seconds)</label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 86400 (1 day)"
            value={delaySeconds}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) {
                setDelaySeconds(e.target.value)
              }
            }}
          />
          <div className="space-y-1">
            {delaySeconds && (
              <p className="text-xs text-muted-foreground">
                = {formatDuration(Number(delaySeconds))}
              </p>
            )}
            {currentDelay !== undefined && (
              <p className="text-xs text-muted-foreground">
                Current delay: {Number(currentDelay as bigint)}s ({formatCountdown(Number(currentDelay as bigint))})
              </p>
            )}
            {maxDelay !== null && (
              <p className="text-xs text-muted-foreground">
                Max allowed: {maxDelay}s ({formatCountdown(maxDelay)}) — must be &lt;= CONFIG_TIME_DELAY
              </p>
            )}
            {exceedsMax && (
              <p className="text-xs text-destructive">
                Value exceeds CONFIG_TIME_DELAY ({maxDelay}s). The contract will revert with InvalidParameter().
              </p>
            )}
          </div>
        </div>

        <Button onClick={() => proposeWithdrawDelay(parsedDelay)} disabled={!canSubmit}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Proposing...
            </>
          ) : (
            "Propose Delay Change"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  if (s > 0) parts.push(`${s}s`)
  return parts.join(" ")
}
