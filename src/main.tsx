import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { WagmiProvider } from "wagmi"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { config } from "@/config/wagmi"
import { ToastProvider } from "@/hooks/ToastProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import App from "./App"
import "./index.css"

export const queryClient = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={100}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
