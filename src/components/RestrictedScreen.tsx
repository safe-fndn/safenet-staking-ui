import { Footer } from "@/components/layout/Footer"

interface RestrictedScreenProps {
  title: string
  description: string
}

export function RestrictedScreen({ title, description }: RestrictedScreenProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
