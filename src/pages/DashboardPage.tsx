import { StatsOverview } from "@/components/dashboard/StatsOverview"
import { EligibilityNotice } from "@/components/dashboard/EligibilityNotice"
import { RewardsSection } from "@/components/dashboard/RewardsSection"
import { UserPositions } from "@/components/dashboard/UserPositions"

export function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Overview of SAFE token delegation</p>
      </div>
      <StatsOverview />
      <EligibilityNotice />
      <RewardsSection />
      <UserPositions />
    </div>
  )
}
