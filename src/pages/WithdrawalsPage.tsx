import { WithdrawalQueue } from "@/components/withdrawals/WithdrawalQueue"

export function WithdrawalsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground">Manage your pending withdrawals and claim undelegated tokens</p>
      </div>
      <WithdrawalQueue />
    </div>
  )
}
