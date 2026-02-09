import { cn } from "@/lib/utils"
import Check from "lucide-react/dist/esm/icons/check"

interface StepperProps {
  steps: string[]
  currentStep: number
  completedSteps: number[]
}

export function Stepper({ steps, currentStep, completedSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const isCompleted = completedSteps.includes(i)
        const isCurrent = i === currentStep
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10",
                  isCompleted || isCurrent ? "bg-primary" : "bg-muted",
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-2 border-primary text-primary"
                      : "border border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  isCurrent ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
