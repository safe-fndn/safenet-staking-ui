import { useCallback, useState, type ReactNode } from "react"
import { ToastContext, type Toast } from "./useToast"

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++nextId
      setToasts((prev) => [...prev, { ...t, id }])
      const duration = t.variant === "error" ? 8000 : 5000
      setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}
