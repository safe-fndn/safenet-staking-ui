import { useToast, type ToastVariant } from "@/hooks/useToast"
import { truncateAddress } from "@/lib/format"
import X from "lucide-react/dist/esm/icons/x"
import CheckCircle from "lucide-react/dist/esm/icons/check-circle"
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle"
import Info from "lucide-react/dist/esm/icons/info"
import { activeChain } from "@/config/chains"

const variantStyles: Record<ToastVariant, string> = {
  success: "border-success/50 bg-card text-success",
  error: "border-destructive/50 bg-card text-destructive",
  info: "border-info/50 bg-card text-info",
}

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

function getExplorerTxUrl(hash: string): string {
  const explorers = activeChain.blockExplorers
  const base = explorers?.default?.url ?? "https://sepolia.etherscan.io"
  return `${base}/tx/${hash}`
}

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full" aria-live="polite" role="status">
      {toasts.map((toast) => {
        const Icon = variantIcons[toast.variant]
        return (
          <div
            key={toast.id}
            className={`rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-2 fade-in motion-reduce:animate-none ${variantStyles[toast.variant]}`}
          >
            <div className="flex gap-3">
              <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs opacity-80">{toast.description}</p>
                )}
                {toast.txHash && (
                  <a
                    href={getExplorerTxUrl(toast.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline opacity-80 hover:opacity-100 font-mono"
                  >
                    Tx: {truncateAddress(toast.txHash)}
                  </a>
                )}
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="shrink-0 opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
