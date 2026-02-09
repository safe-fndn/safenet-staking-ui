import { useState, useEffect } from "react"

export function useCountdown(targetTimestamp: number) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, targetTimestamp - now)
  })

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000)
      setSecondsLeft(Math.max(0, targetTimestamp - now))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetTimestamp])

  return secondsLeft
}
