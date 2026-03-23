import { lazy, useEffect, useRef, type ReactNode } from "react"
import { HashRouter, Routes, Route } from "react-router-dom"
import { useAccount } from "wagmi"
import { Layout } from "@/components/layout/Layout"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Toaster } from "@/components/ui/toaster"
import { RestrictedScreen } from "@/components/RestrictedScreen"
import { Analytics } from "@/components/Analytics"
import { useAutoConnect } from "@/hooks/useAutoConnect"
import { useSanctionsCheck } from "@/hooks/useSanctionsCheck"
import { useGeoblockCheck } from "@/hooks/useGeoblockCheck"
import { useWalletSanctionsCheck } from "@/hooks/useWalletSanctionsCheck"
import { useToast } from "@/hooks/useToast"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

const pageImports = {
  Dashboard: () => import("@/pages/DashboardPage")
    .then(m => ({ default: m.DashboardPage })),
  Validators: () => import("@/pages/ValidatorsPage")
    .then(m => ({ default: m.ValidatorsPage })),
  ValidatorDetail: () => import("@/pages/ValidatorDetailPage")
    .then(m => ({ default: m.ValidatorDetailPage })),
  Withdrawals: () => import("@/pages/WithdrawalsPage")
    .then(m => ({ default: m.WithdrawalsPage })),
  NotFound: () => import("@/pages/NotFoundPage")
    .then(m => ({ default: m.NotFoundPage })),
}

const DashboardPage = lazy(pageImports.Dashboard)
const ValidatorsPage = lazy(pageImports.Validators)
const ValidatorDetailPage = lazy(pageImports.ValidatorDetail)
const WithdrawalsPage = lazy(pageImports.Withdrawals)
const NotFoundPage = lazy(pageImports.NotFound)

/** Preload all route chunks so IPFS-hosted builds are warm. */
function preloadAllRoutes() {
  for (const load of Object.values(pageImports)) {
    void load()
  }
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

  // Preload route chunks after first paint so they don't
  // compete with critical initial resources.
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(preloadAllRoutes)
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(preloadAllRoutes, 1000)
    return () => clearTimeout(id)
  }, [])

  if (sanctionsLoading || geoLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (!sanctionsAllowed || !geoAllowed) {
    return <RestrictedScreen title="Access Restricted" description="SAFE Staking and Rewards are unavailable in your region." />
  }

  return (
    <HashRouter>
      <Analytics />
      <DisconnectWatcher />
      <WalletSanctionsGate>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/validators" element={<ErrorBoundary><ValidatorsPage /></ErrorBoundary>} />
            <Route path="/validators/:address" element={<ErrorBoundary><ValidatorDetailPage /></ErrorBoundary>} />
            <Route path="/withdrawals" element={<ErrorBoundary><WithdrawalsPage /></ErrorBoundary>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </WalletSanctionsGate>
      <Toaster />
    </HashRouter>
  )
}

export default App
