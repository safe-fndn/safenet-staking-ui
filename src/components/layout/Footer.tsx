const docsUrl =
  import.meta.env.VITE_DOCS_URL ||
  "https://docs.safefoundation.org/safenet/introduction"

export function Footer() {
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto flex items-center justify-center gap-6 px-4 py-4 text-sm text-muted-foreground">
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          Documentation
        </a>
      </div>
    </footer>
  )
}
