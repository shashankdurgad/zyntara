import { NextRequest, NextResponse } from "next/server";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================
// 💰 COST CONTROL FLAGS - Toggle to save API credits
// ============================================
const ENABLE_VISION_ANALYSIS = true;      // Set to false to skip Gemini Vision analysis
const ENABLE_IMAGE_GENERATION = true;     // Set to false to skip Gemini 3 Pro Image generation
// ============================================

// Simple prompt template
const SYSTEM_PROMPT = `
You are an expert UX Researcher and Product Manager.
Your goal is to analyze a session of "Visual Feedback" where a persona navigated a website.
Reflect on the user's journey and critiques to provide actionable improvements.

You must accept a JSON input containing:
- Persona Description
- List of Critiques (with reasoning and associated screenshot index)
- List of Screenshots with metadata (url, title, description)

You must output a JSON object with this EXACT structure:
{
  "summary": {
    "ux_score": number (1-100),
    "strengths": ["string", "string"],
    "weaknesses": ["string", "string"],
    "narrative": "A short paragraph summarizing the user's experience."
  },
  "features": [
    {
      "title": "Short Feature Name",
      "description": "Why this fix is needed.",
      "spec": "Technical specification for a developer to implement this fix.",
      "type": "feature" | "bugfix",
      "screenshotIndex": number (index of the most relevant screenshot from the provided list),
      "uiDesignPrompt": "Detailed description of the new UI to implement. For features: describe the exact layout, components, styling, and placement of new elements as they would appear in the final product. For bugfixes: describe the corrected UI state."
    },
    { "title": "...", "description": "...", "spec": "...", "type": "...", "screenshotIndex": ..., "uiDesignPrompt": "..." },
    { "title": "...", "description": "...", "spec": "...", "type": "...", "screenshotIndex": ..., "uiDesignPrompt": "..." }
  ]
}

Classification rules:
- "feature": A new capability or enhancement that doesn't currently exist
- "bugfix": A problem with existing functionality that needs correction

Generate exactly 2 recommendations.
`;

export async function POST(req: NextRequest) {
  try {
    const { critiques, persona, images } = await req.json();

    if (!critiques || critiques.length === 0) {
        return NextResponse.json({ error: "No critiques to analyze" }, { status: 400 });
    }

    if (!images || images.length === 0) {
        return NextResponse.json({ error: "No screenshots available" }, { status: 400 });
    }

    const encoder = new TextEncoder();

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        let isStreamClosed = false;
        
        // Helper to send events (defined outside try-catch for error handling)
        const sendEvent = (type: string, data: any) => {
          if (isStreamClosed) return;
          try {
            // Check if controller is still open
            if (controller.desiredSize === null) {
              isStreamClosed = true;
              return;
            }
            const message = JSON.stringify({ type, data }) + "\n";
            controller.enqueue(encoder.encode(message));
          } catch {
            // Stream closed by client - expected behavior
            isStreamClosed = true;
          }
        };

        try {
          sendEvent("status", "Initializing AI analysis...");

    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: 0.3,
      // @ts-ignore
      modelKwargs: {
              response_mime_type: "application/json",
      },
    });

          // Prepare screenshots metadata
          const screenshotsMetadata = images.map((img: any, idx: number) => ({
            index: idx,
            url: img.url,
            title: img.title,
            description: img.description,
            h1: img.h1
          }));

    const userMessage = `
    Persona: ${persona}
    
    Session Critiques:
    ${JSON.stringify(critiques, null, 2)}
          
          Available Screenshots:
          ${JSON.stringify(screenshotsMetadata, null, 2)}
    `;

          sendEvent("status", "Analyzing UX patterns...");

          // Use streaming for the analysis
          const stream = await chatModel.stream([
              new SystemMessage(SYSTEM_PROMPT),
              new HumanMessage(userMessage)
          ]);

          let fullContent = "";
          for await (const chunk of stream) {
            if (chunk.content) {
              const chunkText = chunk.content.toString();
              fullContent += chunkText;
              // Stream the raw content as it arrives
              sendEvent("chunk", chunkText);
            }
          }

          // Parse the complete JSON output
          let contentStr = fullContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          const result = JSON.parse(contentStr);

          // Send the complete parsed summary
          sendEvent("summary", result.summary);
          sendEvent("status", "Processing feature recommendations...");

          // Two-step process: Analyze screenshot with Vision, then generate annotated image with Gemini 3 Pro Image
          const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
          
          if (!GOOGLE_API_KEY) {
            console.error("Google API key not found");
            sendEvent("error", "API key not configured");
            controller.close();
            return;
          }

          // Initialize vision model for analysis
          const visionModel = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash-exp",
            temperature: 0.4,
          });

          // Process each feature sequentially and stream results
          const featuresWithImages = [];
          
          for (let i = 0; i < result.features.length; i++) {
            const feature = result.features[i];
            sendEvent("status", `Processing ${i + 1}/${result.features.length}: ${feature.title}`);
            
            try {
              const screenshotData = images[feature.screenshotIndex];
              if (!screenshotData) {
                console.error(`Screenshot index ${feature.screenshotIndex} not found`);
                const fallbackFeature = { ...feature, annotatedImage: null };
                featuresWithImages.push(fallbackFeature);
                sendEvent("feature", fallbackFeature);
                continue;
              }

              console.log(`\n=== Processing: ${feature.title} ===`);

              // Check if API calls are enabled
              if (!ENABLE_VISION_ANALYSIS && !ENABLE_IMAGE_GENERATION) {
                console.log(`⚠️  Vision & Image Generation DISABLED - Using original screenshot`);
                const processedFeature = {
                  ...feature,
                  screenshotImage: screenshotData.image,
                  screenshotUrl: screenshotData.url,
                  screenshotTitle: screenshotData.title,
                  annotatedImage: screenshotData.image,
                  annotationData: {
                    summary: "Vision analysis and image generation disabled (cost saving mode)",
                    isGenerated: false
                  }
                };
                featuresWithImages.push(processedFeature);
                sendEvent("feature", processedFeature);
                continue;
              }

          // STEP 1: Analyze screenshot with Gemini Vision and create detailed description
          let detailedDescription = "";
          
          if (ENABLE_VISION_ANALYSIS) {
            const analysisPrompt = feature.type === "feature"
            ? `You are analyzing a website screenshot to create a detailed image generation prompt for rendering the SAME page WITH the new feature actually implemented in the UI.

Screenshot Context: ${screenshotData.url} - ${screenshotData.title}
Feature to Add: "${feature.title}"
Description: ${feature.description}

Analyze this screenshot carefully and create a DETAILED text description for an image generation AI that will recreate this screenshot AS IF the new feature has been fully implemented.

Your description should include:
1. EXACT description of the current screenshot (layout, colors, text, elements, positioning)
2. WHERE the new UI elements should appear (specific positions)
3. WHAT the new elements look like (buttons, inputs, modals, etc.) - styled to match the existing design
4. HOW they integrate with the existing layout (no arrows, labels, or overlay annotations)
5. The final result should look like a real screenshot of the updated website, not a mockup with annotations

Format: Write a single detailed paragraph describing the rendered UI image to generate. Be extremely specific about the new elements' appearance, placement, and styling to match the existing design system.`
            : `You are analyzing a website screenshot to create a detailed image generation prompt for rendering the SAME page WITH the bugfix applied - showing the corrected UI.

Screenshot Context: ${screenshotData.url} - ${screenshotData.title}
Issue Found: "${feature.title}"
Description: ${feature.description}

Analyze this screenshot carefully and create a DETAILED text description for an image generation AI that will recreate this screenshot AS IF the bug has been fixed and the corrected UI is displayed.

Your description should include:
1. EXACT description of the current screenshot (layout, colors, text, elements, positioning)
2. WHAT needs to change to fix the issue (corrected text, fixed layout, resolved visual bug)
3. HOW the corrected elements should look and where they appear
4. The final result should look like a real screenshot of the fixed website - no annotations, circles, or overlay markers
5. Match the existing design system for consistency

Format: Write a single detailed paragraph describing the rendered corrected UI image to generate. Be extremely specific about the fixed elements' appearance and placement.`;

            console.log(`Step 1: 💰 Analyzing screenshot with Gemini Vision...`);
            
            const analysisResponse = await visionModel.invoke([
              new HumanMessage({
                content: [
                  { type: "text", text: analysisPrompt },
                  {
                    type: "image_url",
                    image_url: `data:image/jpeg;base64,${screenshotData.image}`,
                  },
                ],
              }),
            ]);

            detailedDescription = analysisResponse.content.toString();
            console.log(`✓ Analysis complete. Description length: ${detailedDescription.length} chars`);
            console.log(`Description preview: ${detailedDescription.substring(0, 150)}...`);
          } else {
            console.log(`⚠️  Vision Analysis DISABLED - Using fallback description`);
            detailedDescription = `A website screenshot showing ${feature.title}. ${feature.description}. Render the page with the ${feature.type === "feature" ? "new feature implemented" : "bugfix applied"} in the UI - no annotations.`;
          }

          // STEP 2: Generate annotated image using Gemini 3 Pro Image with proper SDK
          let annotatedImageBase64 = null;
          
              if (!ENABLE_IMAGE_GENERATION) {
                console.log(`⚠️  Image Generation DISABLED - Using original screenshot`);
                const processedFeature = {
                  ...feature,
                  screenshotImage: screenshotData.image,
                  screenshotUrl: screenshotData.url,
                  screenshotTitle: screenshotData.title,
                  annotatedImage: screenshotData.image,
                  annotationData: {
                    summary: ENABLE_VISION_ANALYSIS 
                      ? `Vision analysis completed, but image generation disabled (cost saving mode)` 
                      : `Vision analysis and image generation disabled (cost saving mode)`,
                    isGenerated: false,
                    analysisDescription: detailedDescription.substring(0, 200) + "..."
                  }
                };
                featuresWithImages.push(processedFeature);
                sendEvent("feature", processedFeature);
                continue;
              }

          console.log(`Step 2: 💰 Generating annotated image with Gemini 3 Pro Image...`);
          
          const imageGenPrompt = `Create a photorealistic website screenshot showing the page WITH the ${feature.type === "feature" ? "new feature fully implemented" : "bugfix applied and corrected UI"}.

${detailedDescription}

Style requirements:
- Photorealistic website screenshot
- New/corrected UI elements integrated seamlessly into the existing design
- No annotations, arrows, labels, or overlay boxes
- The result should look like a real screenshot of the ${feature.type === "feature" ? "updated" : "fixed"} website
- Match the existing design system (colors, typography, spacing)
- Modern, clean design aesthetic

Generate the complete rendered UI screenshot as described above.`;
          
          try {
            // Initialize Google GenAI client with proper configuration
            const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
            const model = genAI.getGenerativeModel({ 
              model: "gemini-3-pro-image-preview"
            });

            // Generate content with image configuration
            const result = await model.generateContent({
              contents: [{ role: "user", parts: [{ text: imageGenPrompt }] }],
              generationConfig: {
                temperature: 1.0,
                maxOutputTokens: 8192
              }
            });

            const response = await result.response;
            console.log(`Image generation response received`);
            
            // Extract image from response
            if (response.candidates && response.candidates[0]) {
              const candidate = response.candidates[0];
              
              if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                  // Check for inlineData (camelCase - this is the correct property name)
                  if (part.inlineData && part.inlineData.data) {
                    annotatedImageBase64 = part.inlineData.data;
                    console.log(`✓ Successfully generated annotated image for: ${feature.title}`);
                    console.log(`Image size: ${part.inlineData.data.length} bytes`);
                    break;
                  }
                  // Also check inline_data (snake_case) as fallback
                  if ((part as any).inline_data && (part as any).inline_data.data) {
                    annotatedImageBase64 = (part as any).inline_data.data;
                    console.log(`✓ Successfully generated annotated image for: ${feature.title} (snake_case)`);
                    console.log(`Image size: ${(part as any).inline_data.data.length} bytes`);
                    break;
                  }
                }
              }
            }
            
            if (!annotatedImageBase64) {
              console.log(`❌ No image found in response for: ${feature.title}`);
              console.log(`Full response structure:`, JSON.stringify(response).substring(0, 500));
            }
          } catch (imageError: any) {
            console.error(`Image generation error for ${feature.title}:`, imageError.message);
            if (imageError.response) {
              console.error(`Error response:`, JSON.stringify(imageError.response).substring(0, 300));
            }
          }

              const processedFeature = {
                ...feature,
                screenshotImage: screenshotData.image,
                screenshotUrl: screenshotData.url,
                screenshotTitle: screenshotData.title,
                annotatedImage: annotatedImageBase64 || screenshotData.image,
                annotationData: {
                  summary: annotatedImageBase64 
                    ? `Gemini 3 Pro Image generated annotated screenshot based on AI vision analysis` 
                    : `Using original screenshot (Gemini 3 Pro Image generation unavailable)`,
                  isGenerated: !!annotatedImageBase64,
                  analysisDescription: detailedDescription.substring(0, 200) + "..."
                }
              };
              
              featuresWithImages.push(processedFeature);
              sendEvent("feature", processedFeature);

            } catch (error: any) {
              console.error(`Error processing ${feature.title}:`, error);
              const errorFeature = { 
                ...feature, 
                screenshotImage: images[feature.screenshotIndex]?.image || null,
                screenshotUrl: images[feature.screenshotIndex]?.url || null,
                screenshotTitle: images[feature.screenshotIndex]?.title || null,
                annotatedImage: images[feature.screenshotIndex]?.image || null,
                annotationData: { 
                  summary: `Error: ${error.message}`,
                  isGenerated: false
                }
              };
              featuresWithImages.push(errorFeature);
              sendEvent("feature", errorFeature);
            }
          }

          // Send complete event
          sendEvent("complete", {
            summary: result.summary,
            features: featuresWithImages
          });

          controller.close();

        } catch (error: any) {
          console.error("Synthesis Error:", error);
          sendEvent("error", error.message);
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
    console.error("Synthesis Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
