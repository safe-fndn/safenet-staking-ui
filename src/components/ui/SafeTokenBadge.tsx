import { cn } from "@/lib/utils"
import safeToken from "@/assets/token.png"

interface SafeTokenBadgeProps {
  className?: string
}

export function SafeTokenBadge({ className }: SafeTokenBadgeProps) {
  return (
    <img
      src={safeToken}
      alt=""
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    />
  )
}
