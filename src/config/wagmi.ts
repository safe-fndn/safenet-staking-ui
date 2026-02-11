import { createConfig } from "wagmi"
import { injected, walletConnect, safe } from "wagmi/connectors"
import { activeChain, transports } from "./chains"

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const isSafeApp = window.self !== window.top

const connectors = [
  ...(isSafeApp ? [safe()] : []),
  injected(),
  ...(projectId && projectId.length > 0 ? [walletConnect({ projectId })] : []),
]

export const config = createConfig({
  chains: [activeChain],
  connectors,
  transports,
})

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}
