import { formatUnits } from "viem"

/** Format a token amount for display, with comma delimiters. */
export function formatTokenAmount(amount: bigint, decimals = 18, maxDecimals = 4): string {
  const raw = formatTokenAmountRaw(amount, decimals, maxDecimals)
  const [whole, decimal] = raw.split(".")
  const delimited = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return decimal ? `${delimited}.${decimal}` : delimited
}

/** Format a token amount as a plain numeric string (no commas). */
export function formatTokenAmountRaw(amount: bigint, decimals = 18, maxDecimals = 4): string {
  const formatted = formatUnits(amount, decimals)
  const [whole, decimal] = formatted.split(".")
  if (!decimal || maxDecimals === 0) return whole
  return `${whole}.${decimal.slice(0, maxDecimals)}`
}

export function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
