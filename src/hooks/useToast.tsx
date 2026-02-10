import { createContext, useContext } from "react"

export type ToastVariant = "success" | "error" | "info"

export interface Toast {
  id: number
  title: string
  description?: string
  variant: ToastVariant
  txHash?: string
}

export interface ToastContextValue {
  toasts: Toast[]
  toast: (t: Omit<Toast, "id">) => void
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
