import { useCountdown } from "@/hooks/useCountdown"
import { formatCountdown } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

interface CountdownTimerProps {
  claimableAt: number
}

export function CountdownTimer({ claimableAt }: CountdownTimerProps) {
  const secondsLeft = useCountdown(claimableAt)

  if (secondsLeft === 0) {
    return null
  }

  return (
    <Badge variant="outline" className="font-mono">
      {formatCountdown(secondsLeft)}
    </Badge>
  )
}
