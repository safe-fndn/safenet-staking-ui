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

export function AmountInput({ value, onChange, maxAmount, label = "Amount", disabled }: AmountInputProps) {
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
      <div className="flex gap-2">
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
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={disabled}
            onClick={() => onChange(formatTokenAmount(maxAmount, 18, 18))}
          >
            MAX
          </Button>
        )}
      </div>
    </div>
  )
}
