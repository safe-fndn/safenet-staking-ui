import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { DashboardPage } from "../DashboardPage"

// Mock all child components to isolate page-level rendering
vi.mock("@/components/dashboard/StatsOverview", () => ({
  StatsOverview: () => <div data-testid="stats-overview">StatsOverview</div>,
}))

vi.mock("@/components/dashboard/QuickActions", () => ({
  QuickActions: () => <div data-testid="quick-actions">QuickActions</div>,
}))

vi.mock("@/components/dashboard/StakingSection", () => ({
  StakingSection: () => <div data-testid="staking-section">StakingSection</div>,
}))

vi.mock("@/components/dashboard/StakeDistribution", () => ({
  StakeDistribution: () => <div data-testid="stake-distribution">StakeDistribution</div>,
}))

vi.mock("@/components/onboarding/OnboardingBanner", () => ({
  OnboardingBanner: () => <div data-testid="onboarding-banner">OnboardingBanner</div>,
}))

describe("DashboardPage", () => {
  it("renders heading and description", () => {
    render(<DashboardPage />)

    expect(screen.getByText("Stake your SAFE")).toBeInTheDocument()
    expect(screen.getByText(/Earn rewards for helping secure/)).toBeInTheDocument()
  })

  it("renders all child sections", () => {
    render(<DashboardPage />)

    expect(screen.getByTestId("onboarding-banner")).toBeInTheDocument()
    expect(screen.getByTestId("stats-overview")).toBeInTheDocument()
    expect(screen.getByTestId("quick-actions")).toBeInTheDocument()
    expect(screen.getByTestId("staking-section")).toBeInTheDocument()
    expect(screen.getByTestId("stake-distribution")).toBeInTheDocument()
  })
})
