import { WithdrawalQueue } from "@/components/withdrawals/WithdrawalQueue"
import { PageHero } from "@/components/PageHero"
import heroWithdrawals from "@/assets/hero-withdrawals.svg"

export function WithdrawalsPage() {
  return (
    <div className="space-y-8">
      <PageHero
        illustration={heroWithdrawals}
        illustrationAlt="Safe withdrawals"
        title="Withdrawals"
        subtitle="Manage your pending withdrawals and withdraw undelegated tokens"
        serialLabel="// 001"
        specLabel={'[ 3.5" SAFE SHIELD ]'}
      />
      <WithdrawalQueue />
    </div>
  )
}
