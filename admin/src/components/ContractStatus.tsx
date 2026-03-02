import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useContractStatus } from "@/hooks/useAdminReads"
import { truncateAddress, formatCountdown, formatTokenAmount } from "@/lib/format"

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000"

export function ContractStatus() {
  const { data, isLoading } = useContractStatus()

  if (isLoading || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contract Status</CardTitle>
          <CardDescription>Current on-chain state</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  const [ownerResult, delayResult, configDelayResult, pendingDelayResult, pendingValidatorHashResult, totalStakedResult, totalPendingResult] = data

  const owner = ownerResult.status === "success" ? (ownerResult.result as string) : "—"
  const delay = delayResult.status === "success" && typeof delayResult.result === "bigint" ? Number(delayResult.result) : 0
  const configDelay = configDelayResult.status === "success" && typeof configDelayResult.result === "bigint" ? Number(configDelayResult.result) : 0
  const pendingDelay = pendingDelayResult.status === "success"
    ? (pendingDelayResult.result as readonly [bigint, bigint])
    : null
  const pendingValidatorHash = pendingValidatorHashResult.status === "success"
    ? (pendingValidatorHashResult.result as string)
    : null
  const totalStaked = totalStakedResult.status === "success" && typeof totalStakedResult.result === "bigint" ? totalStakedResult.result : 0n
  const totalPending = totalPendingResult.status === "success" && typeof totalPendingResult.result === "bigint" ? totalPendingResult.result : 0n

  const hasPendingDelay = pendingDelay && pendingDelay[1] > 0n
  const hasPendingValidators = pendingValidatorHash && pendingValidatorHash !== ZERO_HASH

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Status</CardTitle>
        <CardDescription>Current on-chain state</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusRow label="Owner" value={truncateAddress(owner)} mono />
          <StatusRow label="Withdraw Delay" value={formatCountdown(delay)} />
          <StatusRow label="Config Time Delay (Timelock)" value={formatCountdown(configDelay)} />
          <StatusRow label="Total Staked" value={`${formatTokenAmount(totalStaked)} SAFE`} />
          <StatusRow label="Total Pending Withdrawals" value={`${formatTokenAmount(totalPending)} SAFE`} />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">Pending Delay Proposal</span>
            {hasPendingDelay ? (
              <Badge variant="destructive">Active</Badge>
            ) : (
              <Badge variant="secondary">None</Badge>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm text-muted-foreground">Pending Validator Proposal</span>
            {hasPendingValidators ? (
              <Badge variant="destructive">Active</Badge>
            ) : (
              <Badge variant="secondary">None</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}
