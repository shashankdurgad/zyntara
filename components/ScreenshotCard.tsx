"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MonitorPlay, Loader2, Play, TreePine } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ScreenshotCardProps {
    currentImage: string | null;
    isRunning: boolean;
    onStart: () => void;
    hasUrl: boolean;
}

export function ScreenshotCard({ currentImage, isRunning, onStart, hasUrl }: ScreenshotCardProps) {

    return (
        <Card className="h-full shadow-lg border flex flex-col overflow-hidden">
            <CardHeader className="border-b bg-primary/5 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MonitorPlay className="w-5 h-5 text-primary" />
                        Visual Agent Verification
                    </CardTitle>

                    <div className="flex gap-2">
                        {/* Start button removed as it's auto-start now, or handled by parent if needed manually? 
                            Wait, the user only asked to move STOP button. 
                            Start button is effectively "Start Auto-Pilot" which is now auto.
                            If I remove onStop, I should probably keep onStart/manual start if user stopped it? 
                            The auto-start logic handles the initial start. 
                            If user stops it, they might want to restart?
                            The previous code had "Start Auto-Pilot" button if !isRunning.
                            Let's keep the Start button here for manual restart if needed, or remove it if we move ALL controls?
                            The request only said "move Stop agent button".
                            But if I move Stop to the bottom bar, it makes sense to have controls together?
                            However, let's stick to the request: "move the 'stop agent' button".
                            Wait, if I remove Stop button from here, where do I put the Start button?
                            If I move Stop button to bottom bar, I should arguably move Start button too or leave it.
                            If I leave Start button here, it's split controls.
                            Actually, looking at the code, if !isRunning, it shows Start button.
                            If I move Stop button, I must also handle the !isRunning state in the bottom bar OR leave Start here.
                            Let's assume we want to move the "Stop" control. 
                            But if I move Stop, I should probably handle the "Running" state indicator too?
                            Actually, simpler: Just remove the button group from header if we move controls to bottom?
                            But keeping "Browsing..." indicator is nice.
                            Let's remove the button group `div className="flex gap-2"` entirely from here 
                            and implement the buttons in page.tsx bottom bar.
                        */}
                    </div>

                    {isRunning && (
                        <div className="absolute right-32 flex items-center gap-2 text-primary text-sm font-medium animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Browsing...
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="p-0 flex flex-col flex-1 h-[600px] overflow-hidden">
                {/* Viewport Area */}
                <div className="flex-1 bg-black/90 relative flex items-start justify-center p-4 border-b overflow-y-auto">
                    {currentImage ? (
                        <img
                            src={`data:image/jpeg;base64,${currentImage}`}
                            alt="Agent View"
                            className="w-full object-contain rounded border shadow-sm"
                        />
                    ) : (
                        <div className="text-center text-muted-foreground space-y-2">
                            <MonitorPlay className="w-12 h-12 mx-auto opacity-20" />
                            <p className="text-sm">Agent Offline</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
