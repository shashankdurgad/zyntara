"use client";

import { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal } from "lucide-react";

export interface AnalysisLog {
    type: "log" | "error" | "action" | "analysis" | "visit";
    data: any;
    timestamp: number;
}

interface AgentLogsProps {
    logs: AnalysisLog[];
}

export function AgentLogs({ logs }: AgentLogsProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <Card className="h-full shadow-lg border flex flex-col overflow-hidden">
            <CardHeader className="border-b bg-primary/5 pb-3 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <Terminal className="w-4 h-4 text-primary" />
                    Agent Logs
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden relative bg-muted/30">
                <div
                    className="h-full p-4 overflow-y-auto font-mono text-xs space-y-2"
                    ref={scrollRef}
                >
                    {logs.length === 0 && <p className="text-muted-foreground opacity-50">Waiting for agent to start...</p>}

                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-300">
                            <span className="text-muted-foreground/50 shrink-0">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                            </span>
                            <div className="break-words w-full">
                                {log.type === 'action' && <span className="text-primary font-bold">➢ ACTION: </span>}
                                {log.type === 'error' && <span className="text-red-500 font-bold">✕ ERROR: </span>}

                                {log.type === 'analysis' ? (
                                    <div className="bg-primary/5 p-2 rounded border border-primary/10 mt-1">
                                        <p className="font-semibold text-primary mb-1">🤖 Persona Critique:</p>
                                        <p className="mb-2 italic opacity-80">"{log.data.critique}"</p>
                                        {log.data.reasoning && <p className="text-[10px] opacity-60">Thought: {log.data.reasoning}</p>}
                                    </div>
                                ) : (
                                    <span>{typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
