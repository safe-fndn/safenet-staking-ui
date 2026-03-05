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
          <Link to="/" className="flex items-center" onClick={closeMobileMenu}>
            <img src="/Safenet.svg" alt="Safenet" className="h-5 dark:invert" />
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
