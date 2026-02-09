import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { Footer } from "./Footer"

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:text-foreground">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="container mx-auto flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
