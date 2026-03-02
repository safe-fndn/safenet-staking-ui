import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTotalStaked, useUserTotalStake } from "@/hooks/useStakingReads"
import { useValidators } from "@/hooks/useValidators"
import { formatTokenAmount } from "@/lib/format"

export function StatsOverview() {
  const { isConnected } = useAccount()
  const { data: totalStaked, isLoading: l1 } = useTotalStaked()
  const { data: userTotalStake, isLoading: l2 } = useUserTotalStake()
  const { data: validators, isLoading: l3 } = useValidators()

  const activeCount = validators ? validators.filter((v) => v.isActive).length : 0

  const stats = [
    {
      title: "Total SAFE Staked",
      value: l1 ? null : `${formatTokenAmount(typeof totalStaked === "bigint" ? totalStaked : 0n, 18, 0)}`,
      loading: l1,
    },
    ...(isConnected
      ? [
          {
            title: "Your Staked SAFE",
            value: l2 ? null : `${formatTokenAmount(typeof userTotalStake === "bigint" ? userTotalStake : 0n, 18, 0)}`,
            loading: l2,
          },
        ]
      : []),
    {
      title: "Active Validators",
      value: l3 ? null : `${activeCount}`,
      loading: l3,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
