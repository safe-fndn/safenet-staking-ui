import { Footer } from "@/components/layout/Footer"

const docsUrl = import.meta.env.VITE_DOCS_URL || "#"

interface RestrictedScreenProps {
  title: string
  description: string
  linkText?: string
}

export function RestrictedScreen({ title, description, linkText = "Learn more about eligibility" }: RestrictedScreenProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline hover:text-primary/80"
          >
            {linkText}
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
