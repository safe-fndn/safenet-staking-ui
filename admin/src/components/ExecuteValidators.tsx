import { useState, useEffect } from "react"
import { isAddress, type Address } from "viem"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { usePendingValidatorChangeHash } from "@/hooks/useAdminReads"
import { useValidatorProposalEvents } from "@/hooks/useValidatorProposalEvents"
import { useExecuteValidatorChanges } from "@/hooks/useAdminWrites"
import { useCountdown } from "@/hooks/useCountdown"
import { useToast } from "@/hooks/useToast"
import { truncateAddress, formatCountdown, formatTimestamp } from "@/lib/format"
import { formatContractError } from "@/lib/errorFormat"
import { Loader2, Plus, Trash2 } from "lucide-react"

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"

interface ManualRow {
  address: string
  register: boolean
}

export function ExecuteValidators() {
  const { data: pendingHash, refetch: refetchHash } = usePendingValidatorChangeHash()
  const { data: proposal, isLoading: isLoadingEvents, refetch: refetchProposal } = useValidatorProposalEvents()
  const { executeValidatorChanges, isPending, isSuccess, error, reset, txHash } = useExecuteValidatorChanges()
  const { toast } = useToast()

  const [manualRows, setManualRows] = useState<ManualRow[]>([{ address: "", register: true }])
  const [manualExecAt, setManualExecAt] = useState("")

  const hash = pendingHash as string | undefined
  const hasPending = hash && hash !== ZERO_HASH

  const executableAt = proposal ? Number(proposal.executableAt) : 0
  const secondsLeft = useCountdown(executableAt)

  const manualExecAtBigint = manualExecAt ? BigInt(manualExecAt) : 0n
  const manualSecondsLeft = useCountdown(manualExecAt ? Number(manualExecAt) : 0)
  const manualAllValid = manualRows.length > 0 &&
    manualRows.every((r) => isAddress(r.address)) &&
    manualExecAtBigint > 0n

  useEffect(() => {
    if (isSuccess) {
      toast({ variant: "success", title: "Validator changes executed", description: "Validator registration/deregistration applied", txHash: txHash! })
      refetchHash()
      refetchProposal()
      reset()
    }
  }, [isSuccess, refetchHash, refetchProposal, reset, toast, txHash])

  useEffect(() => {
    if (error) {
      toast({ variant: "error", title: "Execution failed", description: formatContractError(error) })
    }
  }, [error, toast])

  const addRow = () => setManualRows((prev) => [...prev, { address: "", register: true }])
  const removeRow = (i: number) => setManualRows((prev) => prev.filter((_, idx) => idx !== i))
  const updateRow = (i: number, field: keyof ManualRow, value: string | boolean) =>
    setManualRows((prev) => prev.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)))

  if (!hasPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Execute Validator Changes</CardTitle>
          <CardDescription>No pending validator change proposal.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleExecuteFromEvents = () => {
    if (proposal) {
      executeValidatorChanges(proposal.validators, proposal.isRegistration, proposal.executableAt)
    }
  }

  const handleExecuteManual = () => {
    executeValidatorChanges(
      manualRows.map((r) => r.address as Address),
      manualRows.map((r) => r.register),
      manualExecAtBigint,
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Execute Validator Changes</CardTitle>
        <CardDescription>Execute the pending validator proposal after the timelock expires.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending Hash</span>
            <span className="text-xs font-mono">{hash?.slice(0, 10)}...{hash?.slice(-8)}</span>
          </div>
        </div>

        {proposal ? (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium">Proposed Changes (auto-filled from events)</span>
              <div className="rounded-lg border divide-y">
                {proposal.validators.map((v, i) => (
                  <div key={v} className="flex items-center justify-between p-3">
                    <span className="font-mono text-sm">{truncateAddress(v)}</span>
                    <Badge variant={proposal.isRegistration[i] ? "default" : "destructive"}>
                      {proposal.isRegistration[i] ? "Register" : "Deregister"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">Executable At</span>
              <span className="text-sm font-medium">{formatTimestamp(executableAt)}</span>
            </div>

            <TimelockBadge secondsLeft={secondsLeft} />

            <Button onClick={handleExecuteFromEvents} disabled={secondsLeft > 0 || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Executing...
                </>
              ) : (
                "Execute Validator Changes"
              )}
            </Button>
          </>
        ) : isLoadingEvents ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching for proposal event data...
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              Could not find proposal event data. Enter the proposal parameters manually.
              These must match the pending hash exactly or the transaction will revert.
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium">Validators</span>
              {manualRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="0x... validator address"
                    value={row.address}
                    onChange={(e) => updateRow(i, "address", e.target.value)}
                    className={`flex-1 font-mono ${row.address && !isAddress(row.address) ? "border-destructive" : ""}`}
                  />
                  <select
                    value={row.register ? "register" : "deregister"}
                    onChange={(e) => updateRow(i, "register", e.target.value === "register")}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="register">Register</option>
                    <option value="deregister">Deregister</option>
                  </select>
                  {manualRows.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeRow(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" />
                Add Row
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Executable At (unix timestamp)</label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 1700000000"
                value={manualExecAt}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value)) setManualExecAt(e.target.value)
                }}
              />
              {manualExecAt && (
                <p className="text-xs text-muted-foreground">
                  = {formatTimestamp(Number(manualExecAt))}
                </p>
              )}
            </div>

            {manualExecAt && <TimelockBadge secondsLeft={manualSecondsLeft} />}

            <Button onClick={handleExecuteManual} disabled={!manualAllValid || manualSecondsLeft > 0 || isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Executing...
                </>
              ) : (
                "Execute Validator Changes"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TimelockBadge({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div className="flex items-center gap-3">
      {secondsLeft > 0 ? (
        <Badge variant="outline" className="font-mono">
          {formatCountdown(secondsLeft)} remaining
        </Badge>
      ) : (
        <Badge className="bg-green-600 hover:bg-green-700">Ready to execute</Badge>
      )}
    </div>
  )
}
