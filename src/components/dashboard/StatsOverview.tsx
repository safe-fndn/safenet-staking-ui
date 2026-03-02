import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTotalStaked, useUserTotalStake } from "@/hooks/useStakingReads"
import { useValidators } from "@/hooks/useValidators"
import { formatTokenAmount, asBigint } from "@/lib/format"

export function StatsOverview() {
  const { isConnected } = useAccount()
  const { data: totalStaked, isLoading: loadingTotalStaked } = useTotalStaked()
  const { data: userTotalStake, isLoading: loadingUserStake } = useUserTotalStake()
  const { data: validators, isLoading: loadingValidators } = useValidators()

  const activeCount = validators ? validators.filter((v) => v.isActive).length : 0

  const stats = [
    {
      title: "Total SAFE Staked",
      value: loadingTotalStaked ? null : `${formatTokenAmount(asBigint(totalStaked), 18, 0)}`,
      loading: loadingTotalStaked,
    },
    ...(isConnected
      ? [
          {
            title: "Your Staked SAFE",
            value: loadingUserStake ? null : `${formatTokenAmount(asBigint(userTotalStake), 18, 0)}`,
            loading: loadingUserStake,
          },
        ]
      : []),
    {
      title: "Active Validators",
      value: loadingValidators ? null : `${activeCount}`,
      loading: loadingValidators,
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
