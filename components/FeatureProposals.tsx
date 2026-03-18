"use client";

import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Copy, FileCode, Check, Bug, Sparkles, Image as ImageIcon, Loader2, Github } from "lucide-react"
import { useState, useEffect } from "react"

interface FeatureProposalsProps {
    data: any;
    images?: any[];
    expectedCount?: number; // Expected number of features (default 3)
}

interface GitHubSettings {
    token: string;
    repo: string;
    branch: string;
    geminiApiKey?: string;
}

export function FeatureProposals({ data, images, expectedCount = 2 }: FeatureProposalsProps) {
    // Hooks must be called before any conditional returns
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [exportingIndex, setExportingIndex] = useState<number | null>(null);
    const [exportedIndices, setExportedIndices] = useState<Set<number>>(new Set());
    const [githubSettings, setGithubSettings] = useState<GitHubSettings | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem("zyntara_github");
        if (stored) {
            setGithubSettings(JSON.parse(stored));
        }
    }, []);

    // Early returns after hooks
    if (!data) return <div className="animate-pulse h-full bg-muted/20 rounded-lg" />;
    if (data.error || !data.features) return null;
    
    const isStillLoading = data.features.length < expectedCount;

    const handleCopy = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const handleExportToGitHub = async (feature: any, index: number) => {
        if (!githubSettings) {
            alert("Please configure GitHub integration first. Go to /github to set it up.");
            return;
        }

        // Check if workflow is set up
        const stored = localStorage.getItem("zyntara_github");
        if (stored) {
            const settings = JSON.parse(stored);
            if (!settings.workflowSetup) {
                const proceed = confirm(
                    "The workflow hasn't been set up in your repository yet.\n\n" +
                    "Would you like to go to the GitHub integration page to set it up first?\n\n" +
                    "(The export may fail without the workflow file)"
                );
                if (proceed) {
                    window.location.href = "/github";
                    return;
                }
            }
        }

        setExportingIndex(index);
        console.log("Exporting feature:", feature.title);

        try {
            // Use the trigger endpoint to dispatch GitHub Actions workflow
            const res = await fetch("/api/github/trigger", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token: githubSettings.token,
                    repo: githubSettings.repo,
                    feature: {
                        title: feature.title,
                        type: feature.type || "feature",
                        description: feature.description,
                        spec: feature.spec,
                        affected_files: feature.affected_files,
                        annotatedImage: feature.annotatedImage,
                        screenshots: feature.screenshots
                    },
                    // Pass API key if stored (optional - can use repo secrets instead)
                    apiKey: githubSettings.geminiApiKey
                })
            });

            const result = await res.json();

            console.log("Trigger response:", result);
            
            if (res.ok) {
                setExportedIndices(prev => new Set([...prev, index]));
                
                // Show success message
                alert(
                    `✓ Pull Request workflow triggered!\n\n` +
                    `Feature: ${feature.title}\n\n` +
                    `GitHub Actions is now generating code and will create a PR.\n` +
                    `Click OK to open GitHub Actions and monitor progress.`
                );
                
                // Open GitHub Actions page to see the workflow run
                if (result.actionsUrl) {
                    window.open(result.actionsUrl, "_blank");
                }
            } else {
                console.error("Export failed:", result.error);
                alert(`Export failed: ${result.error}`);
            }
        } catch (error: any) {
            alert(`Export failed: ${error.message}`);
        } finally {
            setExportingIndex(null);
        }
    };

    const isBugfix = (type: string) => type === "bugfix" || type === "bug_fix";

    return (
        <div className="h-full flex flex-col gap-4 overflow-y-auto pr-1">
             <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold font-display">Recommended Features</h3>
                {isStillLoading && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                        <span>Loading {data.features.length}/{expectedCount}...</span>
                    </div>
                )}
             </div>
             
             {data.features.map((feature: any, i: number) => (
                 <Card key={i} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold flex justify-between items-start">
                            {feature.title}
                            <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded-full border border-primary/20">
                                Priority High
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3 text-sm text-muted-foreground space-y-3">
                        <p>{feature.description}</p>
                        
                        {/* AI-Generated Annotated Screenshot Section */}
                        {feature.annotatedImage && (
                            <div className="border rounded-lg overflow-hidden bg-slate-50">
                                <div className="bg-slate-800 text-slate-50 px-3 py-2 text-xs flex items-center gap-2">
                                    <ImageIcon className="w-3 h-3" />
                                    <span>
                                        {feature.annotationData?.isGenerated 
                                            ? "AI-Generated Annotated Image" 
                                            : "Visual Context"}
                                        : {feature.screenshotTitle || feature.screenshotUrl}
                                    </span>
                                </div>
                                
                                {/* Display the annotated image (generated by Gemini 3 Pro or original) */}
                                <div className="relative">
                                    <img 
                                        src={`data:image/jpeg;base64,${feature.annotatedImage}`}
                                        alt={`Screenshot for ${feature.title}`}
                                        className="w-full h-auto"
                                    />
                                    
                                    {/* Loading indicator if generation is in progress */}
                                    {!feature.annotationData?.isGenerated && feature.annotationData?.summary?.includes('generating') && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                            <div className="bg-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                                                <span className="text-sm font-medium">Generating annotations...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* AI Generation Summary */}
                                {feature.annotationData && feature.annotationData.summary && (
                                    <div className={`px-3 py-2 text-xs border-t ${
                                        feature.annotationData.isGenerated 
                                            ? 'bg-primary/5 text-foreground' 
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                        <strong className="text-primary">
                                            {feature.annotationData.isGenerated ? '🎨 AI Generated:' : 'ℹ️ Status:'}
                                        </strong> {feature.annotationData.summary}
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Technical Spec */}
                        <div className="bg-slate-900 text-slate-50 p-3 rounded-md font-mono text-xs overflow-x-auto">
                            <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                                <span className="opacity-50">dev_spec.md</span>
                            </div>
                            <pre className="whitespace-pre-wrap">{feature.spec}</pre>
                        </div>
                    </CardContent>
                    <CardFooter className="pt-0 flex gap-2">
                         <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 gap-2 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                            onClick={() => handleCopy(feature.spec, i)}
                        >
                            {copiedIndex === i ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedIndex === i ? "Copied!" : "Copy Spec"}
                         </Button>
                         
                         {githubSettings && (() => {
                            const isExporting = exportingIndex === i;
                            const isExported = exportedIndices.has(i);
                            return (
                                <Button 
                                    variant={isExported ? "default" : "outline"}
                                    size="sm" 
                                    className={`flex-1 gap-2 transition-colors ${
                                        isExported 
                                            ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                                            : "hover:bg-primary hover:text-primary-foreground hover:border-primary"
                                    }`}
                                    onClick={() => handleExportToGitHub(feature, i)}
                                    disabled={isExporting || isExported}
                                >
                                    {isExporting ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Creating PR...</>
                                    ) : isExported ? (
                                        <><Check className="w-3 h-3" /> PR Created</>
                                    ) : (
                                        <><Github className="w-3 h-3" /> Create Pull Request</>
                                    )}
                                </Button>
                            );
                         })()}
                    </CardFooter>
                 </Card>
             ))}
        </div>
    )
}
