import { createConfig } from "wagmi"
import { injected, walletConnect } from "wagmi/connectors"
import { activeChain, transports } from "./chains"

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const connectors = projectId && projectId.length > 0
  ? [injected(), walletConnect({ projectId })]
  : [injected()]

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
