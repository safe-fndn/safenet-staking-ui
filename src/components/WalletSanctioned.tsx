import { Footer } from "@/components/layout/Footer"

const docsUrl = import.meta.env.VITE_DOCS_URL || "#"

export function WalletSanctioned() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">Wallet Restricted</h1>
          <p className="text-muted-foreground">
            This wallet address has been flagged and cannot use SAFE Staking.
          </p>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline hover:text-primary/80"
          >
            Learn more about eligibility
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
