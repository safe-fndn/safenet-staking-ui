import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const progressVariants = cva("h-2 rounded-full bg-muted overflow-hidden", {
  variants: {
    size: {
      default: "h-2",
      sm: "h-1.5",
      lg: "h-3",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

const indicatorVariants = cva("h-full rounded-full transition-all duration-300", {
  variants: {
    variant: {
      default: "bg-primary",
      success: "bg-success",
      warning: "bg-warning",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressVariants>,
    VariantProps<typeof indicatorVariants> {
  value: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, size, variant, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    return (
      <div ref={ref} className={cn(progressVariants({ size }), className)} {...props}>
        <div
          className={cn(indicatorVariants({ variant }))}
          style={{ width: `${clamped}%` }}
        />
      </div>
    )
  },
)
Progress.displayName = "Progress"

export { Progress }
