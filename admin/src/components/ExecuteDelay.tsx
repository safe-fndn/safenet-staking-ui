import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { usePendingWithdrawDelayChange } from "@/hooks/useAdminReads"
import { useExecuteWithdrawDelayChange } from "@/hooks/useAdminWrites"
import { useCountdown } from "@/hooks/useCountdown"
import { useToast } from "@/hooks/useToast"
import { formatCountdown, formatTimestamp } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2 } from "lucide-react"

export function ExecuteDelay() {
  const { data: pending, refetch } = usePendingWithdrawDelayChange()
  const { executeWithdrawDelayChange, isPending, isSuccess, error, reset, txHash } = useExecuteWithdrawDelayChange()
  const { toast } = useToast()

  const pendingData = pending as readonly [bigint, bigint] | undefined
  const proposedValue = pendingData ? pendingData[0] : 0n
  const executableAt = pendingData ? Number(pendingData[1]) : 0
  const hasPending = executableAt > 0

  const secondsLeft = useCountdown(executableAt)
  const canExecute = hasPending && secondsLeft === 0 && !isPending

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Delay change executed", description: `New withdraw delay applied`, txHash: txHash! })
      refetch()
      reset()
    }
  }, [isSuccess, refetch, reset, toast, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Execution failed", description: formatContractError(error) })
    }
  }, [error, toast])

  if (!hasPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Execute Delay Change</CardTitle>
          <CardDescription>No pending withdraw delay proposal.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execute Delay Change</CardTitle>
        <CardDescription>Execute the pending withdraw delay proposal after the timelock expires.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">Proposed Delay</span>
            <span className="text-sm font-medium">{formatCountdown(Number(proposedValue))} ({Number(proposedValue)}s)</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">Executable At</span>
            <span className="text-sm font-medium">{formatTimestamp(executableAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {secondsLeft > 0 ? (
            <Badge variant="outline" className="font-mono">
              {formatCountdown(secondsLeft)} remaining
            </Badge>
          ) : (
            <Badge className="bg-green-600 hover:bg-green-700">Ready to execute</Badge>
          )}
        </div>

        <Button onClick={() => executeWithdrawDelayChange()} disabled={!canExecute}>
          {isPending ? (
            <>
              <Loader2 className="animate-spin" />
              Executing...
            </>
          ) : (
            "Execute Delay Change"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
