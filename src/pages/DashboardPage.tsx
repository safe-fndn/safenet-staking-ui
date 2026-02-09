import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { ClaimableBanner } from "@/components/dashboard/ClaimableBanner"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { EligibilityNotice } from "@/components/dashboard/EligibilityNotice"
import { RewardsSection } from "@/components/dashboard/RewardsSection"
import { StakeDistribution } from "@/components/dashboard/StakeDistribution"
import { UserPositions } from "@/components/dashboard/UserPositions"
import { TransactionHistory } from "@/components/dashboard/TransactionHistory"
import { OnboardingBanner } from "@/components/onboarding/OnboardingBanner"

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">SAFE Delegation &amp; Claiming</h1>
        <p className="text-muted-foreground">Manage your SAFE token delegation and rewards</p>
      </div>
      <OnboardingBanner />
      <ClaimableBanner />
      <StatsOverview />
      <QuickActions />
      <EligibilityNotice />
      <RewardsSection />
      <StakeDistribution />
      <UserPositions />
      <TransactionHistory />
    </div>
  )
}
