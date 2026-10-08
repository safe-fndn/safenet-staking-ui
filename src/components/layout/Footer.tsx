import { Link } from "react-router-dom"
import { LEGAL_PAGES } from "@/lib/legal"

const docsUrl = import.meta.env.VITE_DOCS_URL || "https://docs.safefoundation.org/safenet/"

const linkClass = "hover:text-foreground transition-colors"

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="container mx-auto flex items-center justify-center gap-6 px-4 py-5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {LEGAL_PAGES.map(({ key, label, path, bundled, url }) => {
          if (bundled) {
            return (
              <Link key={key} to={path} className={linkClass}>
                {label}
              </Link>
            )
          }
          if (url) {
            return (
              <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                {label}
              </a>
            )
          }
          return null
        })}
        <a href={docsUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          Documentation
        </a>
        <a href="https://docs.safefoundation.org/safenet/resources/faq" target="_blank" rel="noopener noreferrer" className={linkClass}>
          FAQ
        </a>
      </div>
    </footer>
  )
}
