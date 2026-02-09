import { useEffect, useRef } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { useAccount } from "wagmi"
import { Layout } from "@/components/layout/Layout"
import { Toaster } from "@/components/ui/toaster"
import { DashboardPage } from "@/pages/DashboardPage"
import { ValidatorsPage } from "@/pages/ValidatorsPage"
import { WithdrawalsPage } from "@/pages/WithdrawalsPage"
import { SanctionsBlocked } from "@/components/SanctionsBlocked"
import { useSanctionsCheck } from "@/hooks/useSanctionsCheck"
import { useToast } from "@/hooks/useToast"

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
    return null
  }

  if (!allowed) {
    return <SanctionsBlocked />
  }

  return (
    <BrowserRouter>
      <DisconnectWatcher />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/validators" element={<ValidatorsPage />} />
          <Route path="/withdrawals" element={<WithdrawalsPage />} />
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
