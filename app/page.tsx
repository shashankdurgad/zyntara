import { PersonaGenerator } from "@/components/PersonaGenerator"
import { GitHubConnectButton } from "@/components/GitHubConnectButton"
import { TreePine } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center relative">
      {/* Header */}
      <header className="w-full border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <TreePine className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">treeminspls</span>
          </div>
          <GitHubConnectButton />
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-16 px-6">
        <div className="text-center space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <TreePine className="w-4 h-4" />
            AI-Powered UX Analysis
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
            treeminspls
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Generate detailed persona profiles and UX recommendations for any website
          </p>
        </div>
        <PersonaGenerator />
      </div>
    </main>
  )
}
