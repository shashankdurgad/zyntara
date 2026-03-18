import { PersonaGenerator } from "@/components/PersonaGenerator"
import { GitHubConnectButton } from "@/components/GitHubConnectButton"
import { Sparkles } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center relative overflow-hidden">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 rounded-full bg-pink-500/15 blur-[100px]" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 rounded-full bg-amber-500/10 blur-[80px]" />
      </div>

      {/* Header */}
      <header className="w-full border-b border-border/50 bg-card/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/25">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight gradient-text">Zyntara</span>
          </div>
          <GitHubConnectButton />
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-6 relative z-10">
        <div className="text-center space-y-5 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            AI-Powered UX Analysis
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight lg:text-6xl gradient-text">
            Zyntara
          </h1>
          <p className="text-muted-foreground text-lg max-w-lg mx-auto font-medium">
            Generate detailed persona profiles and UX recommendations for any website. Built for designers who care about craft.
          </p>
        </div>
        <PersonaGenerator />
      </div>
    </main>
  )
}
