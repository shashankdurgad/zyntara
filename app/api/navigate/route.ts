import { NextRequest, NextResponse } from "next/server";
import { chromium, Browser, Page } from "playwright";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";

export const dynamic = 'force-dynamic';

interface NavigationRequest {
  url: string;
  personaContext: string;
}

export async function POST(req: NextRequest) {
  try {
    const { url, personaContext }: NavigationRequest = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            let browser: Browser | null = null;
            let page: Page | null = null;

            let isStreamClosed = false;

            const sendEvent = (type: string, data: any) => {
                if (isStreamClosed) return;
                try {
                    // Check if controller is still open before enqueueing
                    if (controller.desiredSize === null) {
                        isStreamClosed = true;
                        return;
                    }
                    const message = JSON.stringify({ type, data }) + "\n";
                    controller.enqueue(encoder.encode(message));
                } catch (e) {
                    // Stream closed by client - this is expected, don't log as error
                    isStreamClosed = true;
                }
            };

            try {
                sendEvent("log", "Initializing visual browser agent (LangGraph + Gemini)...");
                
                browser = await chromium.launch({ headless: true });
                page = await browser.newPage();
                await page.setViewportSize({ width: 1280, height: 800 });

                // --- Define Graph State ---
                const GraphState = Annotation.Root({
                    currentUrl: Annotation<string>(),
                    persona: Annotation<string>(),
                    steps: Annotation<number>(),
                    visitedUrls: Annotation<string[]>({ reducer: (cur, update) => cur.concat(update), default: () => [] }),
                    screenshot: Annotation<string>(),
                    links: Annotation<any[]>(),
                    analysis: Annotation<any>(),
                    nextUrl: Annotation<string>(), // Decided target
                    done: Annotation<boolean>(),
                });

                // --- Define Nodes ---
                
                // 1. Navigation Node
                const navigationNode = async (state: typeof GraphState.State) => {
                    let targetUrl = state.nextUrl || state.currentUrl; // Initial or next
                    
                    // Logic: Mark current as visited (before going? or after? logic says we are going there)
                    // The original code marked it as visited inside the loop.
                    
                    sendEvent("visit", targetUrl);
                    sendEvent("log", `Step ${state.steps}: Navigating to ${targetUrl}`);

                    try {
                        await page!.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        await page!.waitForTimeout(2000);
                    } catch (e: any) {
                        sendEvent("error", `Failed to load ${targetUrl}: ${e.message}`);
                        return { done: true }; 
                    }

                    // Hierarchy Logic Check (Record valid visit)
                    // Original code added normalized versions.
                    const newVisited = [targetUrl, targetUrl.replace(/\/$/, "")];

                    const screenshotBuffer = await page!.screenshot({ 
                        fullPage: true, type: 'jpeg', quality: 50 
                    });
                    const base64Image = screenshotBuffer.toString('base64');
                    
                    // Get page metadata
                    const pageMetadata = await page!.evaluate(() => {
                        return {
                            title: document.title || '',
                            description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
                            h1: document.querySelector('h1')?.textContent?.trim() || ''
                        };
                    });
                    
                    sendEvent("screenshot", { 
                        image: base64Image, 
                        url: targetUrl,
                        title: pageMetadata.title,
                        description: pageMetadata.description,
                        h1: pageMetadata.h1,
                        timestamp: Date.now()
                    });
                    sendEvent("log", "Analyzing page visuals...");

                    // Get Links
                    const links = await page!.evaluate(() => {
                        return Array.from(document.querySelectorAll('a[href]'))
                            .map(a => ({
                                text: (a.textContent || '').trim().substring(0, 50),
                                href: (a as HTMLAnchorElement).href
                            }))
                            .filter(l => l.text.length > 0 && l.href.startsWith('http'))
                            .slice(0, 20);
                    });

                    return { 
                        currentUrl: targetUrl, // Update current to where we actually are
                        screenshot: base64Image,
                        links: links,
                        visitedUrls: newVisited,
                        steps: state.steps + 1
                    };
                };

                // 2. Analysis Node
                const analysisNode = async (state: typeof GraphState.State) => {
                    if (isStreamClosed) return { done: true };

                    const visionModel = new ChatGoogleGenerativeAI({
                        model: "gemini-2.5-flash",
                        temperature: 0.2,
                        // @ts-ignore
                        modelKwargs: { response_mime_type: "application/json" }
                    });

                    const prompt = `
                        You are a website user with this persona: "${state.persona}".
                        You are looking at the page: ${state.currentUrl}.
                        
                        1. Provide a brief critique of this page's design and usability based on your persona.
                        2. Decide which link from the following list you would click next to continue navigating.
                        
                        Available Selection:
                        ${state.links.map((l, i) => `${i}. [${l.text}](${l.href})`).join('\n')}
                        
                        Return your response in JSON format:
                        {
                            "critique": "string",
                            "nextActionIndex": number (or -1 if none relevant),
                            "reasoning": "string"
                        }
                    `;

                    const message = new HumanMessage({
                        content: [
                            { type: "text", text: prompt },
                            {
                                type: "image_url",
                                image_url: `data:image/jpeg;base64,${state.screenshot}`,
                            },
                        ],
                    });

                    const aiResponse = await visionModel.invoke([message]);
                    
                    // Parse response safely
                    let decision = { critique: "Failed to parse", nextActionIndex: -1, reasoning: "Error" };
                    try {
                        const content = aiResponse.content.toString();
                         // Clean up potential markdown blocks if Gemini adds them despite JSON mode
                        const cleanContent = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
                        decision = JSON.parse(cleanContent);
                    } catch (e) {
                         console.error("JSON Parse error", e);
                         // Fallback: try to find JSON object in string
                         const match = aiResponse.content.toString().match(/\{[\s\S]*\}/);
                         if (match) {
                             try { decision = JSON.parse(match[0]); } catch (e2) {}
                         }
                    }

                    sendEvent("analysis", decision);

                    // Hierarchy Check & Next URL Logic
                    let nextUrl = "";
                    let done = false;

                    if (decision.nextActionIndex >= 0 && decision.nextActionIndex < state.links.length) {
                        const nextLink = state.links[decision.nextActionIndex];
                        let targetUrl = nextLink.href;
                        let interceptionReason = "";

                        // Hierarchy Enforcement
                        try {
                            const targetObj = new URL(targetUrl);
                            const pathSegments = targetObj.pathname.split('/').filter(p => p);
                            let checkPath = targetObj.origin; 
                            const ancestors = [];
                            for (let i = 0; i < pathSegments.length - 1; i++) { 
                                checkPath = `${checkPath}/${pathSegments[i]}`;
                                ancestors.push(checkPath);
                            }

                            // Check against visited set
                            // state.visitedUrls is string[]
                            const visitedSet = new Set(state.visitedUrls);
                            const unvisitedAncestor = ancestors.find(a => !visitedSet.has(a) && !visitedSet.has(a + "/"));
                            
                            if (unvisitedAncestor) {
                                targetUrl = unvisitedAncestor;
                                interceptionReason = `(Intercepted to enforce hierarchical visit to parent: ${unvisitedAncestor})`;
                            }
                        } catch (e) { console.error("Url parse error", e); }

                        sendEvent("action", `Clicking: ${state.links[decision.nextActionIndex].text} ${interceptionReason}`);
                        nextUrl = targetUrl;
                    } else {
                        sendEvent("log", "No relevant connection found. Ending session.");
                        done = true;
                    }

                    return { analysis: decision, nextUrl, done };
                };

                // --- Build Graph ---
                const workflow = new StateGraph(GraphState)
                    .addNode("navigate", navigationNode)
                    .addNode("analyze", analysisNode)
                    .addEdge(START, "navigate")
                    .addEdge("navigate", "analyze")
                    .addConditionalEdges("analyze", (state) => {
                        if (state.done || state.steps >= 10) return "end"; // Max steps limit hardcoded
                        return "navigate";
                    }, {
                        navigate: "navigate",
                        end: END
                    });

                const app = workflow.compile();

                // --- Run Graph ---
                await app.invoke({
                    currentUrl: url, 
                    nextUrl: url, // First logical target is the start url
                    persona: personaContext,
                    steps: 1, // Start at step 1
                    visitedUrls: [],
                });

                sendEvent("complete", "Session finished.");

            } catch (err: any) {
                console.error("Agent error:", err);
                sendEvent("error", err.message);
            } finally {
                isStreamClosed = true;
                if (browser) await browser.close();
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });

  } catch (error: any) {
     return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
