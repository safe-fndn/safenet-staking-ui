import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { StakingSection } from "@/components/dashboard/StakingSection"
import { StakeDistribution } from "@/components/dashboard/StakeDistribution"
import { PageHero } from "@/components/PageHero"
import heroShields from "@/assets/hero-shields.svg"
import heroShieldsDark from "@/assets/hero-shields-dark.svg"

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHero
        illustration={heroShields}
        illustrationDark={heroShieldsDark}
        illustrationAlt="Safe staking shields"
        title="Stake your SAFE"
        subtitle="Earn rewards for helping secure the Safenet Beta"
      />
      <StatsOverview />
      <QuickActions />
      <StakingSection />
      <StakeDistribution />
    </div>
  )
}
