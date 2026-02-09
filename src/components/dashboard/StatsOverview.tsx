import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTotalStaked, useUserTotalStake } from "@/hooks/useStakingReads"
import { useValidators } from "@/hooks/useValidators"
import { usePendingWithdrawals } from "@/hooks/useWithdrawals"
import { formatTokenAmount } from "@/lib/format"

export function StatsOverview() {
  const { isConnected } = useAccount()
  const { data: totalStaked, isLoading: l1 } = useTotalStaked()
  const { data: userTotalStake, isLoading: l2 } = useUserTotalStake()
  const { data: validators, isLoading: l3 } = useValidators()
  const { data: pendingWithdrawals, isLoading: l4 } = usePendingWithdrawals()

  const activeCount = validators ? validators.filter((v) => v.isActive).length : 0
  const pendingCount = pendingWithdrawals ? (pendingWithdrawals as readonly unknown[]).length : 0

  const stats = [
    {
      title: "Total SAFE Delegated",
      value: l1 ? null : `${formatTokenAmount(totalStaked as bigint ?? 0n)} SAFE`,
      loading: l1,
    },
    ...(isConnected
      ? [
          {
            title: "Your Delegated SAFE",
            value: l2 ? null : `${formatTokenAmount(userTotalStake as bigint ?? 0n)} SAFE`,
            loading: l2,
          },
        ]
      : []),
    {
      title: "Active Validators",
      value: l3 ? null : `${activeCount}`,
      loading: l3,
    },
    ...(isConnected
      ? [
          {
            title: "Unstaking",
            value: l4 ? null : `${pendingCount}`,
            loading: l4,
          },
        ]
      : []),
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stat.loading ? (
              <Skeleton className="h-7 w-32" />
            ) : (
              <p className="text-2xl font-bold">{stat.value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
