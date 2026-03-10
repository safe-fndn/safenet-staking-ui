import { useMemo, lazy, Suspense } from "react"
import { useAccount } from "wagmi"
import { useValidators } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { findValidator } from "@/hooks/useValidators"
import { formatTokenAmount, truncateAddress } from "@/lib/format"
import type { Address } from "viem"

const LazyPieChart = lazy(() =>
  import("recharts").then((m) => ({
    default: ({ data, colors }: { data: ChartEntry[]; colors: string[] }) => (
      <m.ResponsiveContainer width="100%" height="100%">
        <m.PieChart>
          <m.Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="value"
            nameKey="name"
            paddingAngle={2}
          >
            {data.map((entry, i) => (
              <m.Cell key={entry.name} fill={colors[i % colors.length]} />
            ))}
          </m.Pie>
          <m.Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const entry = payload[0].payload as ChartEntry
              return (
                <div className="rounded-lg border bg-background p-2 shadow-md">
                  <p className="text-sm font-medium">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTokenAmount(entry.amount)}
                  </p>
                </div>
              )
            }}
          />
        </m.PieChart>
      </m.ResponsiveContainer>
    ),
  }))
)

const COLORS = [
  "#12FF80", // Safe Green
  "#5FDDFF", // Safe Blue
  "#FF8061", // Safe Orange
  "#00B460", // Safe Dark Green
  "#FF5F72", // Safe Red
  "#B0FFC9", // Safe Light Green
]

interface ChartEntry {
  name: string
  value: number
  address: Address
  amount: bigint
}

export function StakeDistribution() {
  const { isConnected } = useAccount()
  const { data: validators } = useValidators()
  const validatorAddresses = useMemo(() => validators?.map((v) => v.address) ?? [], [validators])
  const { data: stakes, isLoading } = useUserStakesOnValidators(validatorAddresses)

  const chartData = useMemo(() => {
    if (!stakes || !validators) return []
    const data: ChartEntry[] = []
    for (let i = 0; i < validatorAddresses.length; i++) {
      const result = stakes[i]
      if (result.status === "success") {
        if (typeof result.result !== "bigint") continue
        const amount = result.result
        if (amount > 0n) {
          const meta = findValidator(validators, validatorAddresses[i])
          data.push({
            name: meta ? meta.label : truncateAddress(validatorAddresses[i]),
            value: Number(amount / 10n ** 14n) / 10000,
            address: validatorAddresses[i],
            amount,
          })
        }
      }
    }
    return data
  }, [stakes, validators, validatorAddresses])

  if (!isConnected) return null
  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Your Stake Distribution</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48" /></CardContent>
      </Card>
    )
  }
  if (chartData.length < 2) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Stake Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <LazyPieChart data={chartData} colors={COLORS} />
          </Suspense>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 justify-center">
          {chartData.map((entry, i) => (
            <div key={entry.address} className="flex items-center gap-1.5 text-xs">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span>{entry.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
