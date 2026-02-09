import { useMemo } from "react"
import { useAccount } from "wagmi"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { useValidators } from "@/hooks/useValidators"
import { useUserStakesOnValidators } from "@/hooks/useStakingReads"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTokenAmount, truncateAddress } from "@/lib/format"
import type { Address } from "viem"
import validatorData from "@/data/validators.json"

const metadata = validatorData as Record<string, { label: string; commission: number; uptime: number }>

const COLORS = [
  "hsl(142, 76%, 36%)", // green
  "hsl(221, 83%, 53%)", // blue
  "hsl(262, 83%, 58%)", // purple
  "hsl(24, 95%, 53%)",  // orange
  "hsl(350, 89%, 60%)", // red
  "hsl(173, 80%, 40%)", // teal
]

function getLabel(address: string): string {
  const meta = metadata[address.toLowerCase()]
  return meta ? meta.label : truncateAddress(address)
}

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
        const amount = result.result as bigint
        if (amount > 0n) {
          data.push({
            name: getLabel(validatorAddresses[i]),
            value: Number(amount / 10n ** 14n) / 10000, // approximate ETH amount for chart sizing
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
        <CardHeader><CardTitle>Stake Distribution</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48" /></CardContent>
      </Card>
    )
  }
  if (chartData.length < 2) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stake Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const entry = payload[0].payload as ChartEntry
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md">
                      <p className="text-sm font-medium">{entry.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTokenAmount(entry.amount)} SAFE
                      </p>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
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
