import type { ReactNode } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider, createConfig, http } from "wagmi"
import { sepolia } from "wagmi/chains"
import { mock } from "wagmi/connectors"
import { ToastProvider } from "@/hooks/ToastProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { TEST_ACCOUNTS } from "./test-data"

export function createTestConfig({ connected = false } = {}) {
  return createConfig({
    chains: [sepolia],
    connectors: [
      mock({
        accounts: connected ? [TEST_ACCOUNTS.user] : [],
      }),
    ],
    transports: {
      [sepolia.id]: http(),
    },
  })
}

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function AllProviders({
  children,
  config,
  queryClient,
}: {
  children: ReactNode
  config: ReturnType<typeof createTestConfig>
  queryClient: QueryClient
}) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  connected?: boolean
  config?: ReturnType<typeof createTestConfig>
  queryClient?: QueryClient
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    connected = false,
    config,
    queryClient,
    ...renderOptions
  }: CustomRenderOptions = {},
) {
  const testConfig = config ?? createTestConfig({ connected })
  const testQueryClient = queryClient ?? createTestQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AllProviders config={testConfig} queryClient={testQueryClient}>
        {children}
      </AllProviders>
    )
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    config: testConfig,
    queryClient: testQueryClient,
  }
}
