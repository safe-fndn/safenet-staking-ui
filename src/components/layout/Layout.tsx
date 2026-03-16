import { Suspense } from "react"
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"
import Loader2 from "lucide-react/dist/esm/icons/loader-2"

const tickStyle = {
  background: `repeating-linear-gradient(
    to bottom,
    var(--tick-color) 0px,
    var(--tick-color) 1.92px,
    transparent 1.92px,
    transparent 4.92px
  )`,
} as const

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-foreground">
        Skip to main content
      </a>
      <Header />
      <div className="relative flex-1">
        {/* Decorative tick marks + vertical delimiter */}
        <div className="hidden xl:block absolute left-0 top-0 bottom-0 w-[50px] border-r border-black/10 dark:border-white/30 pointer-events-none z-10" aria-hidden="true">
          <div
            className="absolute left-4 top-0 bottom-0 w-[18px] [--tick-color:#DBDBDB] dark:[--tick-color:rgba(255,255,255,0.3)]"
            style={tickStyle}
          />
        </div>
        <div className="hidden xl:block absolute right-0 top-0 bottom-0 w-[50px] border-l border-black/10 dark:border-white/30 pointer-events-none z-10" aria-hidden="true">
          <div
            className="absolute right-4 top-0 bottom-0 w-[18px] [--tick-color:#DBDBDB] dark:[--tick-color:rgba(255,255,255,0.3)]"
            style={tickStyle}
          />
        </div>
        <main id="main-content" className="container mx-auto max-w-5xl px-4 py-8">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <Footer />
    </div>
  )
}
