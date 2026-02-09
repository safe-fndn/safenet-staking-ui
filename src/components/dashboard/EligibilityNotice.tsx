import Info from "lucide-react/dist/esm/icons/info"

const docsUrl = import.meta.env.VITE_DOCS_URL || "#"

export function EligibilityNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-muted-foreground">
          Rewards are subject to a $500 USD weekly cap per user.
        </p>
        <p className="text-muted-foreground">
          KYC may be required —{" "}
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            Learn more
          </a>
        </p>
      </div>
    </div>
  )
}
