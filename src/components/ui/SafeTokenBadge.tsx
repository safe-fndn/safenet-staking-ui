import { cn } from "@/lib/utils"

interface SafeTokenBadgeProps {
  className?: string
}

export function SafeTokenBadge({ className }: SafeTokenBadgeProps) {
  return (
    <img
      src="/token.png"
      alt=""
      className={cn("h-5 w-5 shrink-0", className)}
      aria-hidden="true"
    />
  )
}
