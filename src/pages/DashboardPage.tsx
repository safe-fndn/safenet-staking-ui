import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { StakingSection } from "@/components/dashboard/StakingSection"
import { StakeDistribution } from "@/components/dashboard/StakeDistribution"
import { TransactionHistory } from "@/components/dashboard/TransactionHistory"
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner"

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">SAFE Staking</h1>
        <p className="text-muted-foreground">Manage your SAFE token staking and rewards</p>
      </div>
      <OnboardingBanner />
      <StatsOverview />
      <QuickActions />
      <StakingSection />
      <StakeDistribution />
      <TransactionHistory />
    </div>
  )
}
