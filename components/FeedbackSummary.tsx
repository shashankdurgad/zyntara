"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
// import { Progress } from "@/components/ui/progress"  <-- Removed

// Using standard div for progress to avoid shadcn install dep overhead if missing
import { CheckCircle2, XCircle, Sparkles } from "lucide-react"

interface FeedbackSummaryProps {
    data: any;
    streamingText?: string;
}

export function FeedbackSummary({ data, streamingText }: FeedbackSummaryProps) {
  // Show streaming text while analysis is being generated
  if (!data && streamingText) {
    return (
      <Card className="h-full shadow-lg border border-primary/10 flex flex-col overflow-hidden bg-card/80">
        <CardHeader className="bg-primary/5 border-b pb-6">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            Generating UX Analysis...
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 overflow-y-auto">
          <div className="font-mono text-sm text-muted-foreground whitespace-pre-wrap">
            {streamingText}
            <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1"></span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!data) return <div className="animate-pulse h-full bg-muted/20 rounded-lg flex items-center justify-center text-muted-foreground p-8">Generating Analysis...</div>;
  
  if (data.error) {
      return (
          <Card className="h-full shadow-lg border-2 border-destructive/50 flex flex-col items-center justify-center p-6 text-center">
              <XCircle className="w-12 h-12 text-destructive mb-4" />
              <CardTitle className="text-xl mb-2">Analysis Failed</CardTitle>
              <p className="text-muted-foreground">{data.error}</p>
              <p className="text-xs text-muted-foreground mt-4">Make sure to run the agent to collect critiques first.</p>
          </Card>
      )
  }

  if (!data.summary) return <div className="p-4 text-red-500">Invalid Data Format</div>;

  const { ux_score, strengths, weaknesses, narrative } = data.summary;

  return (
    <Card className="h-full shadow-lg border border-primary/10 flex flex-col overflow-hidden bg-card/80">
      <CardHeader className="bg-primary/5 border-b pb-6">
         <div className="flex justify-between items-start">
            <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                    <Sparkles className="w-6 h-6 text-primary" />
                    UX Synthesis
                </CardTitle>
                <CardDescription className="mt-2 text-base">
                    AI-driven analysis of the user session.
                </CardDescription>
            </div>
            <div className="text-right">
                <div className="text-4xl font-bold text-primary">{ux_score}</div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">UX Score</div>
            </div>
         </div>
         {/* Custom Progress Bar */}
         <div className="mt-4 h-3 w-full bg-primary/20 rounded-full overflow-hidden">
            <div 
                className="h-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${ux_score}%` }} 
            />
         </div>
      </CardHeader>
      
      <CardContent className="p-6 overflow-y-auto space-y-6">
        
        <div className="bg-muted/30 p-4 rounded-lg border border-primary/5">
            <h4 className="font-semibold text-sm mb-2 text-primary">Executive Summary</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
                {narrative}
            </p>
        </div>

        <div className="grid gap-4">
            <div>
                <h4 className="font-semibold text-primary flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4" /> Strong Points
                </h4>
                <ul className="space-y-2">
                    {strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm bg-primary/10 text-foreground px-3 py-2 rounded-md border border-primary/20">
                            {s}
                        </li>
                    ))}
                </ul>
            </div>
            
            <div>
                <h4 className="font-semibold text-destructive flex items-center gap-2 mb-3">
                    <XCircle className="w-4 h-4" /> Areas for Improvement
                </h4>
                <ul className="space-y-2">
                    {weaknesses.map((w: string, i: number) => (
                        <li key={i} className="text-sm bg-destructive/10 text-foreground px-3 py-2 rounded-md border border-destructive/20">
                            {w}
                        </li>
                    ))}
                </ul>
            </div>
        </div>

      </CardContent>
    </Card>
  )
}
