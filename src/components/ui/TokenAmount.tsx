import { formatDisplayAmount, formatTokenAmount } from "@/lib/format"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface TokenAmountProps {
  amount: bigint
  /** Decimals in the compact display (amounts below 1 always get up to 4). */
  maxDecimals?: number
  /** Appended to the display and the tooltip, e.g. "SAFE". */
  suffix?: string
  className?: string
}

/**
 * Compact token amount with the exact amount in a tooltip on hover and as
 * screen-reader text.
 * The tooltip only appears when the compact display drops digits.
 */
export function TokenAmount({ amount, maxDecimals = 4, suffix, className }: TokenAmountProps) {
  const display = formatDisplayAmount(amount, 18, maxDecimals)
  const full = formatTokenAmount(amount, 18, 18)
  const withSuffix = (value: string) => (suffix ? `${value} ${suffix}` : value)

  if (display === full) {
    return <span className={className}>{withSuffix(display)}</span>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Screen readers get the exact amount as text (aria-label on a plain
              span is often ignored); the hover tooltip is for pointer users. */}
          <span className={cn("cursor-help", className)}>
            <span aria-hidden="true">{withSuffix(display)}</span>
            <span className="sr-only">{withSuffix(full)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-mono">{withSuffix(full)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
