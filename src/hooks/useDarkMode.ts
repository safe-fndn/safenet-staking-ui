import { useState, useCallback, useEffect } from "react"
import { isSafeApp } from "@/lib/safe"

/**
 * Known Safe Wallet parent origins. Messages from other origins are
 * silently ignored to prevent untrusted pages from manipulating theme
 * state (OWASP postMessage best practice).
 */
const SAFE_WALLET_ORIGINS: ReadonlySet<string> = new Set([
  "https://app.safe.global",
  "https://safe.global",
])

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

  // Listen for theme messages from Safe Wallet parent and request initial theme
  useEffect(() => {
    if (!isSafeApp) return

    function handleMessage(event: MessageEvent) {
      // Validate origin: only accept messages from known Safe Wallet
      // origins to prevent untrusted pages from manipulating theme.
      if (!SAFE_WALLET_ORIGINS.has(event.origin)) return

      const data = event.data
      if (typeof data !== "object" || data === null) return

      // Safe Wallet wraps theme via MessageFormatter.makeResponse():
      //   { id, success, data: { darkMode: boolean }, version }
      // Also check top-level { darkMode } as a fallback.
      let darkMode: boolean | undefined
      if (typeof data.data?.darkMode === "boolean") {
        darkMode = data.data.darkMode
      } else if (typeof data.darkMode === "boolean") {
        darkMode = data.darkMode
      }

      if (darkMode !== undefined) {
        applyDark(darkMode)
        setIsDark(darkMode)
      }
    }

    window.addEventListener("message", handleMessage)

    // Request current theme from Safe Wallet parent.
    // Must match the Safe Apps SDK message format for the wallet to
    // recognize it.
    //
    // Using "*" as targetOrigin is acceptable here: this is a child
    // iframe asking its parent for the current theme. The request
    // payload contains no sensitive data, and the parent's origin is
    // validated on the response path via SAFE_WALLET_ORIGINS above.
    window.parent.postMessage(
      {
        id: Date.now().toString(),
        method: "getCurrentTheme",
        params: {},
        env: { sdkVersion: "1.0.0" },
      },
      "*",
    )

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
