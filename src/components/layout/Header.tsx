import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ConnectButton } from "@/components/wallet/ConnectButton"
import { useDarkMode } from "@/hooks/useDarkMode"
import { cn } from "@/lib/utils"
import Menu from "lucide-react/dist/esm/icons/menu"
import X from "lucide-react/dist/esm/icons/x"
import Sun from "lucide-react/dist/esm/icons/sun"
import Moon from "lucide-react/dist/esm/icons/moon"
import { Button } from "@/components/ui/button"

function SafeSymbol({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 661.6 661.5" fill="currentColor" className={className} aria-hidden="true">
      <path d="M532,330.7h-49.4c-14.8,0-26.7,12-26.7,26.7v71.7c0,14.8-12,26.7-26.7,26.7H232.5c-14.8,0-26.7,12-26.7,26.7V532c0,14.8,12,26.7,26.7,26.7h208c14.8,0,26.5-12,26.5-26.7v-39.6c0-14.8,12-25.2,26.7-25.2H532c14.8,0,26.7-12,26.7-26.7v-83.3C558.7,342.3,546.7,330.7,532,330.7z"/>
      <path d="M205.8,232.5c0-14.8,12-26.7,26.7-26.7H429c14.8,0,26.7-12,26.7-26.7v-49.4c0-14.8-12-26.7-26.7-26.7H221.1c-14.8,0-26.7,12-26.7,26.7v38.1c0,14.8-12,26.7-26.7,26.7h-38c-14.8,0-26.7,12-26.7,26.7v83.4c0,14.8,12,26.1,26.8,26.1h49.4c14.8,0,26.7-12,26.7-26.7L205.8,232.5z"/>
      <path d="M307.5,278.8H355c15.5,0,28,12.6,28,28v47.5c0,15.5-12.6,28-28,28h-47.5c-15.5,0-28-12.6-28-28v-47.5C279.5,291.3,292.1,278.8,307.5,278.8z"/>
    </svg>
  )
}

const navItems = [
  { label: "Dashboard", path: "/" },
  { label: "Validators", path: "/validators" },
  { label: "Withdrawals", path: "/withdrawals" },
]

export function Header() {
  const { pathname } = useLocation()
  const { isDark, toggle } = useDarkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight" onClick={closeMobileMenu}>
            <SafeSymbol className="h-6 w-6" />
            Safe<span className="text-safe-green">{"{"}</span>Staking<span className="text-safe-green">{"}"}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={pathname === item.path ? "page" : undefined}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  pathname === item.path
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
          </Button>
          <div className="hidden md:block">
            <ConnectButton />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                aria-current={pathname === item.path ? "page" : undefined}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  pathname === item.path
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2">
              <ConnectButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
