import type { LegalPageKey } from "@/lib/legal"

const TITLES: Record<LegalPageKey, string> = {
  terms: "Terms",
  privacy: "Privacy",
  imprint: "Imprint",
}

// Trusted HTML inlined at build time from the deployer's fragment file (see vite.config.ts),
// so it is intentionally not sanitized.
const CONTENT: Record<LegalPageKey, string> = {
  terms: __TERMS_HTML__,
  privacy: __PRIVACY_HTML__,
  imprint: __IMPRINT_HTML__,
}

export function LegalPage({ page }: { page: LegalPageKey }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{TITLES[page]}</h1>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="legal-content" dangerouslySetInnerHTML={{ __html: CONTENT[page] }} />
      </div>
    </div>
  )
}
