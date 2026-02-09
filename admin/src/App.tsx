import { Header } from "@/components/layout/Header"
import { Toaster } from "@/components/ui/toaster"
import { AdminPage } from "@/pages/AdminPage"

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <AdminPage />
      </main>
      <Toaster />
    </div>
  )
}

export default App
