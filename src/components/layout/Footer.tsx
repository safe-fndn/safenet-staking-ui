const docsUrl = import.meta.env.VITE_DOCS_URL || "https://docs.safefoundation.org/safenet/"
const termsUrl = import.meta.env.VITE_TERMS_URL as string | undefined
const privacyUrl = import.meta.env.VITE_PRIVACY_URL as string | undefined
const imprintUrl = import.meta.env.VITE_IMPRINT_URL as string | undefined

const linkClass = "hover:text-foreground transition-colors"

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container mx-auto flex items-center justify-center gap-6 px-4 py-5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {termsUrl && (
          <a href={termsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms
          </a>
        )}
        {privacyUrl && (
          <a href={privacyUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy
          </a>
        )}
        {imprintUrl && (
          <a href={imprintUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Imprint
          </a>
        )}
        <a href={docsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Documentation
        </a>
      </div>
    </footer>
  )
}
