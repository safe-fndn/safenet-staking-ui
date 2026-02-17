import { useState, useCallback, useEffect } from "react"

const isSafeApp = window.self !== window.top

function applyDark(dark: boolean): void {
  if (dark) {
    document.documentElement.classList.add("dark")
  } else {
    document.documentElement.classList.remove("dark")
  }
}

function getInitialDark(): boolean {
  if (typeof window === "undefined") return false
  const stored = localStorage.getItem("theme")
  if (stored === "dark") return true
  if (stored === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function useDarkMode() {
  const [isDark, setIsDark] = useState(getInitialDark)

  // Listen for theme messages from Safe Wallet parent
  useEffect(() => {
    if (!isSafeApp) return

    function handleMessage(event: MessageEvent) {
      const data = event.data
      if (typeof data !== "object" || data === null) return

      // Safe Wallet sends { darkMode: boolean } directly or
      // wraps it in a response with data: { darkMode: boolean }
      let darkMode: boolean | undefined
      if (typeof data.darkMode === "boolean") {
        darkMode = data.darkMode
      } else if (typeof data.data?.darkMode === "boolean") {
        darkMode = data.data.darkMode
      }

      if (darkMode !== undefined) {
        applyDark(darkMode)
        setIsDark(darkMode)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [])

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev
      applyDark(next)
      if (!isSafeApp) {
        localStorage.setItem("theme", next ? "dark" : "light")
      }
      return next
    })
  }, [])

  return { isDark, toggle, isSafeApp }
}
