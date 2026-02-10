import Info from "lucide-react/dist/esm/icons/info"

const rewardsDocsUrl = "https://docs.safefoundation.org/safenet/protocol/rewards#minimum-payout-threshold"

export function EligibilityNotice() {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4 text-sm">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-muted-foreground">
          Rewards are subject to a minimum payout threshold.{" "}
          <a
            href={rewardsDocsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            Learn more
          </a>
        </p>
        <p className="text-muted-foreground">
          KYC may be required to claim rewards.
        </p>
      </div>
    </div>
  )
}
