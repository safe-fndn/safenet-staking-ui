import { useEffect } from "react"
import { useConnect, useReconnect } from "wagmi"
import { isSafeApp } from "@/lib/safe"

const AUTOCONNECTED_CONNECTOR_IDS = ["safe"]

/**
 * Auto-connects to the Safe wallet when loaded inside a Safe App iframe.
 * Falls back to wagmi's reconnect (restoring the last used wallet) otherwise.
 *
 * This replaces wagmi's built-in reconnectOnMount so that Safe Apps always
 * connect to the Safe connector instead of whichever wallet was last used.
 */
export function useAutoConnect() {
  const { connect, connectors } = useConnect()
  const { reconnect } = useReconnect()

  useEffect(() => {
    if (isSafeApp) {
      for (const id of AUTOCONNECTED_CONNECTOR_IDS) {
        const connector = connectors.find((c) => c.id === id)
        if (connector) {
          connect({ connector })
          return
        }
      }
    }

    // Outside Safe context, restore previous wallet session
    reconnect()
  }, [connect, connectors, reconnect])
}
