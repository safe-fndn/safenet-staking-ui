import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatTokenAmount } from "@/lib/format"

interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  maxAmount?: bigint
  label?: string
  disabled?: boolean
}

const PERCENTAGES = [25, 50, 75, 100] as const

export function AmountInput({ value, onChange, maxAmount, label = "Amount", disabled }: AmountInputProps) {
  function setPercentage(pct: number) {
    if (maxAmount === undefined) return
    if (pct === 100) {
      onChange(formatTokenAmount(maxAmount, 18, 18))
    } else {
      const amount = (maxAmount * BigInt(pct)) / 100n
      onChange(formatTokenAmount(amount, 18, 18))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {maxAmount !== undefined && (
          <span className="text-xs text-muted-foreground">
            Balance: {formatTokenAmount(maxAmount)} SAFE
          </span>
        )}
      </div>
      <Input
        type="text"
        inputMode="decimal"
        placeholder="0.0"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value
          if (/^[0-9]*\.?[0-9]*$/.test(val)) {
            onChange(val)
          }
        }}
      />
      {maxAmount !== undefined && (
        <div className="flex gap-2">
          {PERCENTAGES.map((pct) => (
            <Button
              key={pct}
              variant="ghost"
              size="sm"
              className="flex-1 text-xs"
              disabled={disabled}
              onClick={() => setPercentage(pct)}
            >
              {pct === 100 ? "MAX" : `${pct}%`}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
