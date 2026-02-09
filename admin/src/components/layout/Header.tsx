import { ConnectButton } from "@/components/wallet/ConnectButton"

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">SAFE Staking</span>
          <span className="text-sm font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            Admin
          </span>
        </div>
        <ConnectButton />
      </div>
    </header>
  )
}
