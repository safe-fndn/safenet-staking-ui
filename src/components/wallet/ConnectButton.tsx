import { useRef, useState, useEffect, useCallback } from "react"
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi"
import { Button } from "@/components/ui/button"
import { truncateAddress, formatTokenAmount } from "@/lib/format"
import { activeChain } from "@/config/chains"
import { useTokenBalance } from "@/hooks/useTokenBalance"
import { useToast } from "@/hooks/useToast"
import { copyToClipboard } from "@/lib/clipboard"
import Copy from "lucide-react/dist/esm/icons/copy"
import { SafeTokenBadge } from "@/components/ui/SafeTokenBadge"
import { isSafeApp } from "@/lib/safe"

export function ConnectButton() {
  const hasInjectedWallet = typeof window.ethereum !== "undefined"
  const { address, isConnected, chain } = useAccount()
  const { connect: rawConnect, connectors: allConnectors } = useConnect()
  const connectors = allConnectors.filter((c) => {
    if (c.id === "browserWallet") return hasInjectedWallet
    if (c.id === "walletConnect") return true
    return false
  })
  const { disconnect, disconnectAsync } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { data: balance } = useTokenBalance()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const connect: typeof rawConnect = useCallback(
    (variables, options) => {
      rawConnect(variables, {
        ...options,
        async onError(error) {
          if (/already connected/i.test(error.message)) {
            await disconnectAsync()
            rawConnect(variables, options)
            return
          }
          toast({
            variant: "error",
            title: "Connection failed",
            description: error.message.slice(0, 150),
          })
          options?.onError?.(error, variables, undefined, undefined as never)
        },
      })
    },
    [rawConnect, disconnectAsync, toast],
  )

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
    // In iframe, Safe auto-connect handles connection — no button needed
    if (isSafeApp) return null

    // Single connector: connect directly without menu
    if (connectors.length === 1) {
      return (
        <Button onClick={() => connect({ connector: connectors[0] })}>
          Connect Wallet
        </Button>
      )
    }

    return (
      <div className="relative" ref={menuRef} role="none" onKeyDown={handleKeyDown}>
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
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent focus:bg-accent focus:outline-none transition-colors text-left"
                onClick={() => {
                  setMenuOpen(false)
                  connect({ connector })
                }}
              >
                {connector.icon && (
                  <img src={connector.icon} alt="" className="h-5 w-5 shrink-0 rounded" aria-hidden="true" />
                )}
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
        <span className="hidden lg:inline-flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
          {formatTokenAmount(typeof balance === "bigint" ? balance : 0n, 18, 0)} <SafeTokenBadge />
        </span>
      )}
      <button
        className="flex items-center gap-1.5 text-sm font-mono bg-secondary px-3 py-1.5 rounded-md hover:bg-secondary/80 transition-colors"
        onClick={async () => {
          if (!address) return
          const ok = await copyToClipboard(address)
          if (ok) toast({ variant: "success", title: "Address copied" })
        }}
        title="Copy address"
      >
        {truncateAddress(address ?? "")}
        <Copy className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
      </button>
      {!isSafeApp && (
        <Button variant="outline" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      )}
    </div>
  )
}
