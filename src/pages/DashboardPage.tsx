import { Link } from "react-router-dom"
import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { QuickActions } from "@/components/dashboard/QuickActions"
import { StakingSection } from "@/components/dashboard/StakingSection"
import { StakeDistribution } from "@/components/dashboard/StakeDistribution"
import { PageHero } from "@/components/PageHero"
import { getLegalPage } from "@/lib/legal"
import heroShields from "@/assets/hero-shields.svg"
import heroShieldsDark from "@/assets/hero-shields-dark.svg"

const terms = getLegalPage("terms")
const termsLinkClass = "underline hover:text-foreground transition-colors"

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHero
        illustration={heroShields}
        illustrationDark={heroShieldsDark}
        illustrationAlt="Safe staking shields"
        title="Stake your SAFE"
        subtitle="Earn rewards for helping secure Safenet Beta"
      >
        <p className="mt-3 text-xs uppercase tracking-[-0.02em] text-foreground/50 font-mono opacity-[0.56]">
          Rewards are not guaranteed and may vary.{" "}
          {terms.bundled ? (
            <Link to={terms.path} className={termsLinkClass}>
              See terms for details.
            </Link>
          ) : terms.url ? (
            <a href={terms.url} target="_blank" rel="noopener noreferrer" className={termsLinkClass}>
              See terms for details.
            </a>
          ) : (
            "See terms for details."
          )}
        </p>
      </PageHero>
      <StatsOverview />
      <QuickActions />
      <StakingSection />
      <StakeDistribution />
    </div>
  )
}
