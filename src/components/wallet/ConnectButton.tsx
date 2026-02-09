import { useRef, useState, useEffect, useCallback } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import { activeChain } from "@/config/chains"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { useToast } from "@/hooks/useToast"

export function ConnectButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balance } = useTokenBalance()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Show toast on connection failure
  useEffect(() => {
    if (connectError) {
      toast({ variant: "error", title: "Connection failed", description: connectError.message.slice(0, 150) })
    }
  }, [connectError, toast])

  // Close on outside click
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

  // Auto-focus first item on open
  useEffect(() => {
    if (menuOpen && itemRefs.current[0]) {
      itemRefs.current[0].focus()
    }
  }, [menuOpen])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!menuOpen) return

      if (e.key === "Escape") {
        e.preventDefault()
        setMenuOpen(false)
        triggerRef.current?.focus()
        return
      }

      const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)

      if (e.key === "ArrowDown") {
        e.preventDefault()
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0
        items[next]?.focus()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1
        items[prev]?.focus()
      }
    },
    [menuOpen],
  )

  if (!isConnected) {
    return (
      <div className="relative" ref={menuRef} onKeyDown={handleKeyDown}>
        <Button
          ref={triggerRef}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          Connect Wallet
        </Button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-lg border bg-card p-2 shadow-lg z-50"
            role="menu"
          >
            {connectors.map((connector, i) => (
              <button
                key={connector.uid}
                ref={(el) => { itemRefs.current[i] = el }}
                role="menuitem"
                tabIndex={-1}
                className="flex w-full items-center rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent focus:bg-accent focus:outline-none transition-colors text-left"
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
      {balance !== undefined && (
        <span className="text-sm text-muted-foreground">
          {formatTokenAmount(balance as bigint)} SAFE
        </span>
      )}
      <span className="text-sm font-mono bg-secondary px-3 py-1.5 rounded-md">
        {truncateAddress(address!)}
      </span>
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  )
}
