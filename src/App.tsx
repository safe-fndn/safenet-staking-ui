import { lazy, useEffect, useRef, type ReactNode } from "react"
import { HashRouter, Routes, Route } from "react-router-dom"
import { useAccount } from "wagmi"
import { Layout } from "@/components/layout/Layout"
import { Toaster } from "@/components/ui/toaster"
import { RestrictedScreen } from "@/components/RestrictedScreen"
import { useAutoConnect } from "@/hooks/useAutoConnect"
import { useSanctionsCheck } from "@/hooks/useSanctionsCheck"
import { useGeoblockCheck } from "@/hooks/useGeoblockCheck"
import { useWalletSanctionsCheck } from "@/hooks/useWalletSanctionsCheck"
import { useToast } from "@/hooks/useToast"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

const pageImports = {
  Dashboard: () => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })),
  Validators: () => import("@/pages/ValidatorsPage").then(m => ({ default: m.ValidatorsPage })),
  ValidatorDetail: () => import("@/pages/ValidatorDetailPage").then(m => ({ default: m.ValidatorDetailPage })),
  Withdrawals: () => import("@/pages/WithdrawalsPage").then(m => ({ default: m.WithdrawalsPage })),
  NotFound: () => import("@/pages/NotFoundPage").then(m => ({ default: m.NotFoundPage })),
  TermsOfUse: () => import("@/pages/TermsOfUsePage").then(m => ({ default: m.TermsOfUsePage })),
  Faq: () => import("@/pages/FaqPage").then(m => ({ default: m.FaqPage })),
}

const DashboardPage = lazy(pageImports.Dashboard)
const ValidatorsPage = lazy(pageImports.Validators)
const ValidatorDetailPage = lazy(pageImports.ValidatorDetail)
const WithdrawalsPage = lazy(pageImports.Withdrawals)
const NotFoundPage = lazy(pageImports.NotFound)
const TermsOfUsePage = lazy(pageImports.TermsOfUse)
const FaqPage = lazy(pageImports.Faq)

// Preload all route chunks after initial render so IPFS-hosted builds are warm
function preloadAllRoutes() {
  for (const load of Object.values(pageImports)) {
    void load()
  }
}

if ("requestIdleCallback" in window) {
  requestIdleCallback(preloadAllRoutes)
} else {
  setTimeout(preloadAllRoutes, 1000)
}

function DisconnectWatcher() {
  const { isConnected } = useAccount()
  const wasConnected = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    if (isConnected) {
      wasConnected.current = true
    } else if (wasConnected.current) {
      wasConnected.current = false
      toast({
        variant: "info",
        title: "Wallet disconnected",
        description: "Please reconnect to continue.",
      })
    }
  }, [isConnected, toast])

  return null
}

function WalletSanctionsGate({ children }: { children: ReactNode }) {
  const { allowed, isLoading } = useWalletSanctionsCheck()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (!allowed) {
    return <RestrictedScreen title="Wallet Restricted" description="This wallet address has been flagged and cannot use SAFE Staking." />
  }

  return <>{children}</>
}

function App() {
  useAutoConnect()
  const { allowed: sanctionsAllowed, isLoading: sanctionsLoading } = useSanctionsCheck()
  const { allowed: geoAllowed, isLoading: geoLoading } = useGeoblockCheck()

  if (sanctionsLoading || geoLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (!sanctionsAllowed || !geoAllowed) {
    return <RestrictedScreen title="Access Restricted" description="SAFE Staking and Rewards are unavailable in your region." linkText="Learn more about eligibility here" />
  }

  return (
    <HashRouter>
      <DisconnectWatcher />
      <WalletSanctionsGate>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/validators" element={<ValidatorsPage />} />
            <Route path="/validators/:address" element={<ValidatorDetailPage />} />
            <Route path="/withdrawals" element={<WithdrawalsPage />} />
            <Route path="/terms" element={<TermsOfUsePage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </WalletSanctionsGate>
      <Toaster />
    </HashRouter>
  )
}

export default App
