import { useRef, useState, useEffect } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { truncateAddress } from "@/lib/format"
import { activeChain } from "@/config/chains"

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [menuOpen])

  if (!isConnected) {
    return (
      <div className="relative" ref={menuRef}>
        <Button onClick={() => setMenuOpen((v) => !v)}>Connect Wallet</Button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card p-2 shadow-lg">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                className="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent transition-colors text-left"
                onClick={() => {
                  setMenuOpen(false)
                  connect({ connector })
                }}
              >
                {connector.name}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (chain?.id !== activeChain.id) {
    return (
      <Button variant="destructive" onClick={() => switchChain({ chainId: activeChain.id })}>
        Switch to {activeChain.name}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-mono bg-secondary px-3 py-1.5 rounded-md">
        {truncateAddress(address!)}
      </span>
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  )
}
