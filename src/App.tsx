import { useEffect, useRef } from "react"
import { HashRouter, Routes, Route } from "react-router-dom"
import { useAccount } from "wagmi"
import { Layout } from "@/components/layout/Layout"
import { Toaster } from "@/components/ui/toaster"
import { DashboardPage } from "@/pages/DashboardPage"
import { ValidatorsPage } from "@/pages/ValidatorsPage"
import { WithdrawalsPage } from "@/pages/WithdrawalsPage"
import { ValidatorDetailPage } from "@/pages/ValidatorDetailPage"
import { NotFoundPage } from "@/pages/NotFoundPage"
import { SanctionsBlocked } from "@/components/SanctionsBlocked"
import { useSanctionsCheck } from "@/hooks/useSanctionsCheck"
import { useToast } from "@/hooks/useToast"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

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

function App() {
  const { allowed, isLoading } = useSanctionsCheck()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  if (!allowed) {
    return <SanctionsBlocked />
  }

  return (
    <HashRouter>
      <DisconnectWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/validators" element={<ValidatorsPage />} />
          <Route path="/validators/:address" element={<ValidatorDetailPage />} />
          <Route path="/withdrawals" element={<WithdrawalsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  )
}

export default App
