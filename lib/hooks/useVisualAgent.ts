"use client";

import { useState, useRef, useCallback } from "react";
import { AnalysisLog } from "@/components/AgentLogs";

export function useVisualAgent() {
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<AnalysisLog[]>([]);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const stopAgent = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsRunning(false);
            setLogs(prev => [...prev, { type: "log", data: "Agent stopped by user.", timestamp: Date.now() }]);
        }
    }, []);

    const startAgent = useCallback(async (url: string, context: string | null, onUrlVisited?: (url: string) => void) => {
        if (!url) return;
        // Check ref directly if possible or isRunning state. 
        // Since isRunning state update is async, checks here might assume 'false' if called rapidly.
        // But for this use case it's fine.

        setIsRunning(true);
        // Clear previous logs on restart? Maybe not, context is useful. Let's keep them or options to clear.
        // For now, let's append to keep history.
        setLogs(prev => [...prev, { type: "log", data: "Agent starting...", timestamp: Date.now() }]);

        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch("/api/navigate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, personaContext: context }),
                signal: abortControllerRef.current.signal
            })

            if (!response.ok || !response.body) throw new Error("Failed to connect to agent")

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const msg = JSON.parse(line)
                        if (msg.type === "screenshot") {
                            // msg.data contains { image, url, title, description, h1, timestamp }
                            setCurrentImage(msg.data.image)
                            
                            // Also store full screenshot metadata for later use
                            try {
                                const stored = localStorage.getItem("zyntara_screenshots");
                                const screenshots = stored ? JSON.parse(stored) : [];
                                screenshots.push(msg.data);
                                if (screenshots.length > 20) screenshots.shift(); // Keep last 20
                                localStorage.setItem("zyntara_screenshots", JSON.stringify(screenshots));
                            } catch (e) { console.error("Screenshot storage error", e); }
                        } else if (msg.type === "visit") {
                            if (onUrlVisited) onUrlVisited(msg.data);
                        } else {
                            setLogs(prev => [...prev, { type: msg.type, data: msg.data, timestamp: Date.now() }]);

                            // Persist critiques
                            if (msg.type === "analysis") {
                                try {
                                    const stored = localStorage.getItem("zyntara_critiques");
                                    const critiques = stored ? JSON.parse(stored) : [];
                                    critiques.push({
                                        critique: msg.data.critique,
                                        reasoning: msg.data.reasoning,
                                        timestamp: Date.now()
                                    });
                                    localStorage.setItem("zyntara_critiques", JSON.stringify(critiques));
                                } catch (err) { console.error("Storage error", err); }
                            }
                        }
                    } catch (e) {
                        console.error("Parse error", e);
                    }
                }
            }

        } catch (e: any) {
            if (e.name === 'AbortError') return;
            setLogs(prev => [...prev, { type: "error", data: e.message, timestamp: Date.now() }])
        } finally {
            setIsRunning(false)
            abortControllerRef.current = null;
        }
    }, []); // Empty deps as logic is self contained or uses refs/setters

    return {
        logs,
        currentImage,
        isRunning,
        startAgent,
        stopAgent
    };
}
