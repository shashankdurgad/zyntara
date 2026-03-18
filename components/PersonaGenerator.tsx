"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, ArrowRight, AlertCircle, ExternalLink, FileText } from "lucide-react"
import Link from "next/link"

export function PersonaGenerator() {
  const router = useRouter()
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null)
  const [criteria, setCriteria] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [useManual, setUseManual] = useState(false)
  const [manualContext, setManualContext] = useState("")

  useEffect(() => {
    const stored = localStorage.getItem("zyntara_github")
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

  const handleGeneratePersona = async () => {
    if (!websiteUrl) {
      setError("Please configure your website URL in the GitHub integration settings first.")
      return
    }
    if (!criteria.trim()) {
      setError("Please provide persona criteria.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/persona/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, criteria: criteria.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.details || "Failed to generate persona")
      }

      sessionStorage.setItem("zyntara_rag_profile", JSON.stringify(data))
      const params = new URLSearchParams({ url: websiteUrl, mode: "rag" })
      router.push(`/result?${params.toString()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate persona")
      setIsLoading(false)
    }
  }

  const handleManualAnalyze = () => {
    if (!websiteUrl) {
      setError("Please configure your website URL in the GitHub integration settings first.")
      return
    }
    if (!manualContext.trim()) {
      setError("Please provide a persona description.")
      return
    }

    setIsLoading(true)
    const params = new URLSearchParams({
      url: websiteUrl,
      context: manualContext.trim(),
    })
    router.push(`/result?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <Card className="gradient-border shadow-xl shadow-primary/5">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Start Analysis</CardTitle>
          <CardDescription>
            Generate a persona from the Nemotron dataset or describe one manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {websiteUrl ? (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="w-4 h-4 text-primary" />
                <span className="font-medium truncate max-w-[280px]">{websiteUrl}</span>
              </div>
              <Link href="/github" className="text-xs text-primary hover:underline">
                Change
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <span>No website configured</span>
              </div>
              <Link href="/github" className="text-xs text-primary hover:underline font-medium">
                Configure
              </Link>
            </div>
          )}

          {!useManual ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="criteria" className="text-sm font-medium">
                  Persona Criteria
                </Label>
                <Textarea
                  id="criteria"
                  placeholder="e.g., tech worker in Seattle, age 30-40, interested in productivity tools"
                  value={criteria}
                  onChange={(e) => setCriteria(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setUseManual(true)}
                className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                Use manual description instead
              </button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="manual" className="text-sm font-medium">
                  Persona Description
                </Label>
                <Textarea
                  id="manual"
                  placeholder="e.g., A 30-year-old tech enthusiast looking for productivity tools..."
                  value={manualContext}
                  onChange={(e) => setManualContext(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setUseManual(false)}
                className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                Generate from dataset instead
              </button>
            </>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </CardContent>
        <CardFooter className="pt-2">
          {!useManual ? (
            <Button
              onClick={handleGeneratePersona}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading || !websiteUrl || !criteria.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Persona...
                </>
              ) : (
                <>
                  Generate Persona
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleManualAnalyze}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading || !websiteUrl || !manualContext.trim()}
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
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
