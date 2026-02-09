import { useAccount } from "wagmi"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useTransactionHistory, type TransactionRecord, type TxType } from "@/hooks/useTransactionHistory"
import { useValidatorMetadata } from "@/hooks/useValidatorMetadata"
import { formatTokenAmount, truncateAddress } from "@/lib/format"
import { activeChain } from "@/config/chains"
import ArrowUpRight from "lucide-react/dist/esm/icons/arrow-up-right"
import ArrowDownLeft from "lucide-react/dist/esm/icons/arrow-down-left"
import HandCoins from "lucide-react/dist/esm/icons/hand-coins"
import ExternalLink from "lucide-react/dist/esm/icons/external-link"
import type { Address } from "viem"

function getExplorerTxUrl(hash: string): string {
  const explorers = activeChain.blockExplorers
  const base = explorers?.default?.url ?? "https://sepolia.etherscan.io"
  return `${base}/tx/${hash}`
}

const typeConfig: Record<TxType, { label: string; icon: typeof ArrowUpRight; color: string }> = {
  delegation: { label: "Delegated", icon: ArrowUpRight, color: "text-success" },
  withdrawal_initiated: { label: "Undelegated", icon: ArrowDownLeft, color: "text-warning" },
  withdrawal_claimed: { label: "Claimed", icon: HandCoins, color: "text-info" },
}

function ValidatorName({ address }: { address: Address }) {
  const metadata = useValidatorMetadata(address)
  return <span>{metadata ? metadata.label : truncateAddress(address)}</span>
}

function TxRow({ tx }: { tx: TransactionRecord }) {
  const config = typeConfig[tx.type]
  const Icon = config.icon

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <Icon className={`h-4 w-4 ${config.color}`} aria-hidden="true" />
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{config.label}</Badge>
            {tx.validator && (
              <span className="text-sm text-muted-foreground">
                <ValidatorName address={tx.validator} />
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{formatTokenAmount(tx.amount)} SAFE</span>
        {tx.txHash && (
          <a
            href={getExplorerTxUrl(tx.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  )
}

function TxList({ transactions }: { transactions: TransactionRecord[] }) {
  if (transactions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No transactions found.</p>
  }
  return (
    <div>
      {transactions.map((tx, i) => (
        <TxRow key={`${tx.txHash}-${i}`} tx={tx} />
      ))}
    </div>
  )
}

export function TransactionHistory() {
  const { isConnected } = useAccount()
  const { data: transactions, isLoading } = useTransactionHistory()

  if (!isConnected) return null

  const all = transactions ?? []
  const delegations = all.filter((tx) => tx.type === "delegation")
  const withdrawals = all.filter((tx) => tx.type === "withdrawal_initiated" || tx.type === "withdrawal_claimed")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="delegations">Delegations</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <TxList transactions={all} />
            </TabsContent>
            <TabsContent value="delegations">
              <TxList transactions={delegations} />
            </TabsContent>
            <TabsContent value="withdrawals">
              <TxList transactions={withdrawals} />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
