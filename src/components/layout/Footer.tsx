const touUrl = import.meta.env.VITE_TOU_URL || "#"
const docsUrl = import.meta.env.VITE_DOCS_URL || "#"
const faqUrl = import.meta.env.VITE_FAQ_URL || "#"

export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto flex items-center justify-center gap-6 px-4 py-4 text-sm text-muted-foreground">
        <a href={touUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Terms of Use
        </a>
        <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Documentation
        </a>
        <a href={faqUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          FAQ
        </a>
      </div>
    </footer>
  )
}
