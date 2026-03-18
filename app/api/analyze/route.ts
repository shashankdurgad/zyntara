import { NextRequest, NextResponse } from "next/server"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { HumanMessage, SystemMessage } from "@langchain/core/messages"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, personaContext } = body

    if (!url || !personaContext) {
      return NextResponse.json(
        { error: "URL and Persona Context are required" },
        { status: 400 }
      )
    }

    // Initialize the Gemini model
    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 8192,
      temperature: 0.7,
      // @ts-ignore - modelKwargs is supported in runtime but types might be outdated or strict
      modelKwargs: {
        response_mime_type: "application/json",
      },
    })

    const systemPrompt = `You are an expert user persona profiler. Your job is to create a detailed, realistic persona profile based on a specific website context and a user description.
    
    Output the result strictly in JSON format with the following structure:
    {
      "profile": {
        "name": "Fictional Name",
        "demographics": { "age": "...", "location": "...", "job_title": "..." },
        "psychographics": { "goals": [], "frustrations": [], "interests": [], "values": [] },
        "browsing_behavior": "Description of how they browse...",
        "relationship_with_site": "How this persona relates to the website content..."
      },
      "analysis_context": "Reasoning for this profile..."
    }
    `

    const userPrompt = `Website URL: ${url}
    Persona Context provided: ${personaContext}
    
    Analyze the likely user persona matching this context for this specific website. Provide a deep dive.`

    const stream = await chatModel.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ])

    // Convert the iterator to a ReadableStream
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          // Chunk content is the text token
          if (chunk.content) {
            controller.enqueue(new TextEncoder().encode(chunk.content as string));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      }
    })
  } catch (error: any) {
    console.error("Error in analysis:", error)
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    )
  }
}
