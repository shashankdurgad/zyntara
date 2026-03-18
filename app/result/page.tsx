"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState, useRef, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { SitemapVisualizer } from "@/components/SitemapVisualizer"
import { ScreenshotCard } from "@/components/ScreenshotCard"
import { ArrowRight, RotateCcw, User, Play, Loader2, Sparkles } from "lucide-react"
import { FeedbackSummary } from "@/components/FeedbackSummary"
import { FeatureProposals } from "@/components/FeatureProposals"
import { PersonaProfileCard } from "@/components/PersonaProfileCard"

import { useVisualAgent } from "@/lib/hooks/useVisualAgent"
import { AgentLogs } from "@/components/AgentLogs"
import { useCallback } from "react"
import { GitHubConnectButton } from "@/components/GitHubConnectButton"

function ResultContent() {
    const searchParams = useSearchParams()
    const url = searchParams.get("url")
    const context = searchParams.get("context")

    const [result, setResult] = useState("")
    const [isComplete, setIsComplete] = useState(false)
    const [step, setStep] = useState(1) // 1: Profile+Sitemap, 2: Sitemap+Screenshot, 3: Feedback+Specs
    const [visitedPaths, setVisitedPaths] = useState<string[]>([])
    const [synthesisData, setSynthesisData] = useState<any>(null)
    const hasStarted = useRef(false)

    // Visual Agent Hook
    const { logs, currentImage, isRunning, startAgent, stopAgent } = useVisualAgent();

    const handleUrlVisited = useCallback((visitedUrl: string) => {
        // Logic to ensure parent nodes are also marked as visited (No skipping)
        try {
            const urlObj = new URL(visitedUrl);
            const pathSegments = urlObj.pathname.split('/').filter(p => p);

            const pathsToAdd = [visitedUrl];

            // Reconstruct all parent paths
            // start with root
            let currentPath = urlObj.origin;
            pathsToAdd.push(currentPath); // Add root

            for (const segment of pathSegments) {
                currentPath = `${currentPath}/${segment}`;
                pathsToAdd.push(currentPath);
            }

            setVisitedPaths(prev => {
                const newPaths = [...prev];
                pathsToAdd.forEach(p => {
                    if (!newPaths.includes(p)) newPaths.push(p);
                });
                return newPaths;
            });

        } catch (e) {
            // Fallback for simple paths or invalid URLs
            // Safe functional update
            setVisitedPaths(prev => {
                if (!prev.includes(visitedUrl)) return [...prev, visitedUrl];
                return prev;
            });
        }
    }, []); // Stable callback

    const hasAutoStarted = useRef(false);

    // Reset auto-start flag when leaving step 2
    useEffect(() => {
        if (step !== 2) {
            hasAutoStarted.current = false;
        }
    }, [step]);

    // Auto-start Agent Effect
    useEffect(() => {
        if (step === 2 && !isRunning && !hasAutoStarted.current) {
            hasAutoStarted.current = true;
            startAgent(url || "", context || "", handleUrlVisited);
        }
    }, [step, isRunning, startAgent, url, context, handleUrlVisited]);

    // Synthesis Effect - handles streaming response
    useEffect(() => {
        if (step === 3 && !synthesisData) {
            const fetchSynthesis = async () => {
                try {
                    const storedCritiques = localStorage.getItem("zyntara_critiques")
                    const critiques = storedCritiques ? JSON.parse(storedCritiques) : []

                    const storedScreenshots = localStorage.getItem("zyntara_screenshots")
                    const images = storedScreenshots ? JSON.parse(storedScreenshots) : []

                    const res = await fetch("/api/synthesize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ critiques, persona: result, images })
                    })

                    if (!res.ok || !res.body) {
                        console.error("Synthesis request failed");
                        return;
                    }

                    // Handle streaming response
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = "";
                    let tempSummary: any = null;
                    let tempFeatures: any[] = [];

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || "";

                        for (const line of lines) {
                            if (!line.trim()) continue;

                            try {
                                const event = JSON.parse(line);

                                if (event.type === "summary") {
                                    tempSummary = event.data;
                                    setSynthesisData({ summary: tempSummary, features: tempFeatures });
                                } else if (event.type === "feature") {
                                    tempFeatures.push(event.data);
                                    setSynthesisData({ summary: tempSummary, features: [...tempFeatures] });
                                } else if (event.type === "complete") {
                                    setSynthesisData(event.data);
                                    // Clear storage after successful synthesis
                                    localStorage.removeItem("zyntara_critiques");
                                    localStorage.removeItem("zyntara_screenshots");
                                } else if (event.type === "status") {
                                    console.log("Status:", event.data);
                                } else if (event.type === "error") {
                                    console.error("Synthesis error:", event.data);
                                }
                            } catch (e) {
                                console.error("Parse error:", e);
                            }
                        }
                    }
                } catch (e) { console.error("Synthesis failed", e) }
            }
            fetchSynthesis()
        }
    }, [step, synthesisData, result])


    useEffect(() => {
        if (!url || !context || hasStarted.current) return

        const fetchData = async () => {
            hasStarted.current = true
            try {
                const res = await fetch("/api/analyze", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url, personaContext: context }),
                })

                if (!res.ok) throw new Error("Analysis failed")
                if (!res.body) throw new Error("No response body")

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let done = false

                while (!done) {
                    const { value, done: doneReading } = await reader.read()
                    done = doneReading
                    const chunkValue = decoder.decode(value)
                    setResult((prev) => prev + chunkValue)
                }
                setIsComplete(true)
            } catch (error) {
                console.error(error)
                setResult("Error occurred during analysis. Please try again.")
                setIsComplete(true)
            }
        }

        fetchData()
    }, [url, context])


    return (
        <div className="w-full max-w-[95vw] mx-auto pb-6 overflow-hidden relative">

            {/* Container for sliding panes - Dynamic height to fit above toolbar */}
            <div className="flex h-[calc(100vh-180px)] min-h-[500px] w-full relative">

                {/* Pane 1: Profile (Step 1 only) */}
                <div
                    className={`transition-all duration-700 ease-in-out absolute top-0 left-0 h-full ${step === 1 ? "w-1/2 opacity-100 z-10" :
                        step === 2 ? "w-0 opacity-0 -translate-x-full z-0 pointer-events-none" :
                            "w-0 opacity-0 -translate-x-full z-0 pointer-events-none"
                        }`}
                >
                    <div className="space-y-6 h-full">
                        {(() => {
                            let parsedData = null;
                            try {
                                if (result && isComplete) {
                                    // Robust brace counting to isolate JSON object
                                    const firstBrace = result.indexOf('{');
                                    if (firstBrace !== -1) {
                                        let balance = 0;
                                        let lastBrace = -1;
                                        let inString = false;
                                        let escape = false;

                                        for (let i = firstBrace; i < result.length; i++) {
                                            const char = result[i];
                                            if (escape) { escape = false; continue; }
                                            if (char === '\\') { escape = true; continue; }
                                            if (char === '"') { inString = !inString; continue; }
                                            if (!inString) {
                                                if (char === '{') balance++;
                                                else if (char === '}') {
                                                    balance--;
                                                    if (balance === 0) { lastBrace = i; break; }
                                                }
                                            }
                                        }

                                        if (lastBrace !== -1) {
                                            const jsonString = result.substring(firstBrace, lastBrace + 1);
                                            parsedData = JSON.parse(jsonString);
                                        }
                                    }
                                }
                            } catch (e) {
                                // Ignore parse errors
                            }

                            return parsedData ? (
                                <PersonaProfileCard data={parsedData} />
                            ) : (
                                <Card className="h-full shadow-lg border border-primary/10 bg-card/80 backdrop-blur-sm">
                                    <CardHeader className="border-b bg-muted/20">
                                        <CardTitle className="flex items-center gap-2">
                                            <User className="w-5 h-5 text-primary" />
                                            Persona Generation
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center justify-center h-[600px] p-4 text-muted-foreground gap-4">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="font-medium">Generating persona profile...</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })()}
                    </div>
                </div>

                {/* Pane 2: Sitemap (Step 1: Right, Step 2: Left Split, Step 3: Hidden) */}
                <div
                    className={`transition-all duration-700 ease-in-out absolute top-0 h-full flex flex-col gap-4 ${step === 1 ? "w-1/2 left-1/2 opacity-100 z-10" :
                        step === 2 ? "w-1/2 left-0 opacity-100 z-10 pr-6" :
                            "w-0 left-0 opacity-0 -translate-x-full z-0 pointer-events-none"
                        }`}
                >
                    {/* Top Half (or Full if Step 1) */}
                    <div className={`w-full transition-all duration-500 ease-in-out ${step === 2 ? 'h-1/2' : 'h-full'}`}>
                        <SitemapVisualizer url={url || ""} visitedPaths={visitedPaths} />
                    </div>

                    {/* Bottom Half (Logs - Step 2 only) */}
                    {step === 2 && (
                        <div className="w-full h-1/2 animate-in slide-in-from-bottom-10 fade-in duration-700">
                            <AgentLogs logs={logs} />
                        </div>
                    )}
                </div>

                {/* Pane 3: Screenshot (Step 2: Right, Step 3: Hidden) */}
                <div
                    className={`transition-all duration-700 ease-in-out absolute top-0 right-0 h-full ${step === 2 ? "w-1/2 opacity-100 z-10 pl-0" :
                        step === 3 ? "w-0 opacity-0 translate-x-full z-0 pointer-events-none" :
                            "w-0 opacity-0 translate-x-full z-0 pointer-events-none"
                        }`}
                >
                    <div className="space-y-6 h-full pl-6">
                        <ScreenshotCard
                            currentImage={currentImage}
                            isRunning={isRunning}
                            onStart={() => startAgent(url || "", context || "", handleUrlVisited)}
                            hasUrl={!!url}
                        />
                    </div>
                </div>

                {/* Pane 4: Synthesis Results (Step 3 Only: Full Width split in 2) */}
                <div
                    className={`transition-all duration-700 ease-in-out absolute top-0 left-0 w-full h-full flex gap-6 ${step === 3 ? "opacity-100 translate-x-0 z-20" : "opacity-0 translate-x-full z-0 pointer-events-none"
                        }`}
                >
                    {/* Prominent Loading Overlay */}
                    {step === 3 && !synthesisData && (
                        <div className="absolute inset-0 z-50 bg-background flex items-center justify-center">
                            <div className="text-center space-y-8">
                                {/* Animated Logo/Icon */}
                                <div className="relative">
                                    <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary/30 to-pink-500/30 flex items-center justify-center animate-pulse border border-primary/20">
                                        <Sparkles className="w-12 h-12 text-primary" />
                                    </div>
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center">
                                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                                    </div>
                                </div>
                                
                                {/* Text */}
                                <div className="space-y-3">
                                    <h2 className="text-3xl font-bold text-foreground">
                                        Generating UX Analysis
                                    </h2>
                                    <p className="text-lg text-muted-foreground max-w-md mx-auto">
                                        AI is analyzing your session and preparing recommendations...
                                    </p>
                                </div>
                                
                                {/* Progress Dots */}
                                <div className="flex justify-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-3 h-3 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-3 h-3 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="w-1/2 h-full">
                        <FeedbackSummary data={synthesisData} />
                    </div>
                    <div className="w-1/2 h-full">
                        <FeatureProposals data={synthesisData} />
                    </div>
                </div>

            </div>

            {/* Sticky Bottom Actions */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-card/90 backdrop-blur-xl border border-primary/20 shadow-2xl shadow-primary/10 rounded-full px-8 py-3 flex items-center gap-4 transition-all hover:scale-[1.02]">
                    {step === 3 && (
                        <Button variant="ghost" onClick={() => setStep(2)} size="lg" className="rounded-full">
                            Back to Testing
                        </Button>
                    )}
                    
                    {step === 3 && synthesisData && (
                        <Button variant="outline" asChild size="lg" className="rounded-full">
                            <Link href="/"><RotateCcw className="w-4 h-4 mr-2" /> New Analysis</Link>
                        </Button>
                    )}

                    {step === 1 && (
                        <Button
                            size="lg"
                            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                            onClick={() => setStep(2)}
                            disabled={!isComplete}
                        >
                            Continue to Visual Agent <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    )}

                    {step === 2 && (
                        <>
                            <Button variant="ghost" onClick={() => setStep(1)} size="lg" className="rounded-full">
                                Back
                            </Button>

                            {/* Start/Stop Agent Button */}
                            {isRunning ? (
                                <Button
                                    size="lg"
                                    variant="destructive"
                                    className="rounded-full"
                                    onClick={stopAgent}
                                >
                                    <div className="w-3 h-3 bg-white rounded-sm mr-2" />
                                    Stop Agent
                                </Button>
                            ) : (
                                <Button
                                    size="lg"
                                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => startAgent(url || "", context || "", handleUrlVisited)}
                                >
                                    <Play className="w-4 h-4 mr-2 fill-current" />
                                    Start Auto-Pilot
                                </Button>
                            )}

                            <Button
                                size="lg"
                                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => setStep(3)}
                                disabled={isRunning}
                            >
                                Generate Final Report <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function ResultPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20 pt-20">
                <header className="fixed top-0 left-0 right-0 border-b border-border/50 bg-card/80 backdrop-blur-xl z-50 h-16 flex items-center justify-between px-8">
                    <Link href="/" className="font-display font-bold text-lg tracking-tight flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center shadow-lg shadow-primary/25">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="gradient-text">Zyntara</span>
                    </Link>
                    <GitHubConnectButton />
                </header>
                <ResultContent />
            </div>
        </Suspense>
    )
}
