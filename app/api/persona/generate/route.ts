import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const PERSONA_SERVICE_URL =
  process.env.PERSONA_SERVICE_URL || "http://localhost:8000";

function formatPersonaExamples(personas: Record<string, unknown>[]): string {
  return personas
    .map((p, i) => {
      const parts: string[] = [];
      for (const key of [
        "persona",
        "professional_persona",
        "cultural_background",
        "skills_and_expertise",
        "hobbies_and_interests",
        "career_goals_and_ambitions",
        "age",
        "occupation",
        "city",
        "state",
      ]) {
        const v = p[key];
        if (v != null && String(v).trim()) {
          parts.push(`${key}: ${v}`);
        }
      }
      return `--- Example ${i + 1} ---\n${parts.join("\n")}`;
    })
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, criteria } = body;

    if (!url || !criteria) {
      return NextResponse.json(
        { error: "URL and criteria are required" },
        { status: 400 }
      );
    }

    // 1. Call Python service for retrieval
    let personas: Record<string, unknown>[] = [];
    try {
      const retrieveRes = await fetch(`${PERSONA_SERVICE_URL}/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: criteria, k: 5 }),
        signal: AbortSignal.timeout(15000),
      });

      if (!retrieveRes.ok) {
        throw new Error(`Retrieve failed: ${retrieveRes.status}`);
      }

      const retrieveData = await retrieveRes.json();
      personas = retrieveData.personas || [];
    } catch (fetchError: unknown) {
      const msg =
        fetchError instanceof Error ? fetchError.message : "Retrieve failed";
      console.error("Persona service retrieve error:", msg);
      return NextResponse.json(
        {
          error: "Persona retrieval service unavailable. Ensure the persona service is running (npm run persona:service).",
          details: msg,
        },
        { status: 503 }
      );
    }

    // 2. Build prompt with retrieved examples
    const examplesText =
      personas.length > 0
        ? formatPersonaExamples(personas)
        : "(No similar personas retrieved; generate based on criteria alone.)";

    const systemPrompt = `You are an expert user persona profiler. Your job is to create a detailed, realistic persona profile grounded in example personas from the NVIDIA Nemotron-Personas-USA dataset (a diverse US demographic dataset).

Using the example personas below as style and distribution reference, generate a NEW persona that matches the user's criteria. Map Nemotron-style fields into the output schema:
- persona + professional_persona → demographics.job_title, psychographics
- cultural_background → demographics.location, psychographics.values
- skills_and_expertise, hobbies_and_interests → psychographics.interests
- career_goals_and_ambitions → psychographics.goals
- age, occupation, city, state → demographics

Output the result strictly in JSON format with this EXACT structure:
{
  "profile": {
    "name": "Fictional Name",
    "demographics": { "age": "...", "location": "...", "job_title": "..." },
    "psychographics": { "goals": [], "frustrations": [], "interests": [], "values": [] },
    "browsing_behavior": "Description of how they browse the web...",
    "relationship_with_site": "How this persona relates to the given website..."
  },
  "analysis_context": "Brief reasoning for this profile..."
}`;

    const userPrompt = `Website URL: ${url}
User criteria: ${criteria}

Example personas from Nemotron-Personas-USA (use as grounding for style and diversity):
${examplesText}

Generate a new persona matching the criteria, grounded in the examples above. Output valid JSON only.`;

    // 3. Generate profile with Gemini
    // @ts-expect-error - modelKwargs supported at runtime
    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      maxOutputTokens: 8192,
      temperature: 0.7,
      modelKwargs: {
        response_mime_type: "application/json",
      },
    });

    const response = await chatModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    let content = (response.content as string) || "";
    content = content.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

    let result: { profile: unknown; analysis_context: string };
    try {
      result = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model", raw: content.slice(0, 500) },
        { status: 500 }
      );
    }

    if (!result.profile) {
      return NextResponse.json(
        { error: "Model did not return a profile", raw: result },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Persona generate error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
