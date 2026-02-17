import { createConfig } from "wagmi"
import { injected, walletConnect, safe } from "wagmi/connectors"
import { activeChain, transports } from "./chains"

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const connectors = [
  safe({
    allowedDomains: [/^app\.safe\.global$/],
    debug: false,
  }),
  injected({
    target: {
      id: "browserWallet",
      name: "Browser Wallet",
      provider: () => window.ethereum,
    },
  }),
  ...(projectId && projectId.length > 0
    ? [walletConnect({ projectId })]
    : []),
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
