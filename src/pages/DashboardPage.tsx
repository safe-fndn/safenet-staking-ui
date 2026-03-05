import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { StakingSection } from "@/components/dashboard/StakingSection"
import { StakeDistribution } from "@/components/dashboard/StakeDistribution"
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner"

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Stake your SAFE</h1>
        <p className="text-muted-foreground">Earn rewards for helping secure the Safenet Beta</p>
      </div>
      <OnboardingBanner />
      <StatsOverview />
      <QuickActions />
      <StakingSection />
      <StakeDistribution />
    </div>
  )
}
