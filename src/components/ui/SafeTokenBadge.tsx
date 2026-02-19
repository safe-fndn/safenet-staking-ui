import { cn } from "@/lib/utils"

interface SafeTokenBadgeProps {
  className?: string
}

export function SafeTokenBadge({ className }: SafeTokenBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <img src="/token.png" alt="" className="h-4 w-4" aria-hidden="true" />
      SAFE
    </span>
  )
}
