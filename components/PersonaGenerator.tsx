"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, TreePine, ArrowRight, AlertCircle, ExternalLink } from "lucide-react"
import Link from "next/link"

export function PersonaGenerator() {
  const router = useRouter()
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null)
  const [personaContext, setPersonaContext] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load website URL from GitHub settings in localStorage
  useEffect(() => {
    const stored = localStorage.getItem("treeminspls_github")
    if (stored) {
      try {
        const settings = JSON.parse(stored)
        if (settings.websiteUrl) {
          setWebsiteUrl(settings.websiteUrl)
        }
      } catch (e) {
        console.error("Failed to parse settings", e)
      }
    }
  }, [])

  const handleAnalyze = () => {
    if (!websiteUrl) {
      setError("Please configure your website URL in the GitHub integration settings first.")
      return
    }
    if (!personaContext) {
      setError("Please provide a persona description.")
      return
    }

    setIsLoading(true)
    // Redirect to the result page with query params
    const params = new URLSearchParams({
      url: websiteUrl,
      context: personaContext,
    })
    
    router.push(`/result?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <Card className="border shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <TreePine className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Start Analysis</CardTitle>
          <CardDescription>
            Describe the user persona to analyze your website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {/* Website URL Status */}
          {websiteUrl ? (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="font-medium truncate max-w-[280px]">{websiteUrl}</span>
              </div>
              <Link 
                href="/github" 
                className="text-xs text-primary hover:underline"
              >
                Change
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <span>No website configured</span>
              </div>
              <Link 
                href="/github" 
                className="text-xs text-primary hover:underline font-medium"
              >
                Configure
              </Link>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="persona" className="text-sm font-medium">Persona Description</Label>
            <Textarea
              id="persona"
              placeholder="e.g., A 30-year-old tech enthusiast looking for productivity tools..."
              value={personaContext}
              onChange={(e) => setPersonaContext(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
        <CardFooter className="pt-2">
          <Button 
            onClick={handleAnalyze} 
            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading || !websiteUrl}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Analysis...
              </>
            ) : (
              <>
                Start Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
