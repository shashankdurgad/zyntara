import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

// Maximum payload size for repository_dispatch (approximately 65KB)
const MAX_PAYLOAD_SIZE = 60000; // Leave some buffer
const MAX_IMAGE_SIZE = 35000; // Max ~35KB for base64 image data (~26KB actual image)

interface FeaturePayload {
  title: string;
  type: string;
  description: string;
  spec?: string;
  affected_files?: string[];
  screenshots?: Array<{
    image: string;
    url?: string;
    title?: string;
  }>;
  annotatedImage?: string;
}

// Compress image using sharp - resize and reduce quality to fit within size limit
async function compressImage(base64: string, maxBase64Size: number): Promise<{ data: string; compressed: boolean; originalSize: number; finalSize: number }> {
  const originalSize = base64.length;
  
  // If already small enough, return as-is
  if (originalSize <= maxBase64Size) {
    return { data: base64, compressed: false, originalSize, finalSize: originalSize };
  }
  
  try {
    // Decode base64 to buffer
    const buffer = Buffer.from(base64, "base64");
    
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    const originalWidth = metadata.width || 800;
    const originalHeight = metadata.height || 600;
    
    // Calculate target size - aim for ~25KB of actual image data
    // Base64 is ~33% larger than binary, so 35KB base64 ≈ 26KB binary
    const targetBytes = Math.floor(maxBase64Size * 0.75); // Account for base64 overhead
    
    // Try progressively smaller sizes and lower quality
    const attempts = [
      { width: Math.min(originalWidth, 800), quality: 60 },
      { width: Math.min(originalWidth, 600), quality: 50 },
      { width: Math.min(originalWidth, 400), quality: 40 },
      { width: Math.min(originalWidth, 300), quality: 30 },
      { width: 200, quality: 25 },
    ];
    
    for (const attempt of attempts) {
      const resized = await sharp(buffer)
        .resize(attempt.width, null, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: attempt.quality, progressive: true })
        .toBuffer();
      
      const resizedBase64 = resized.toString("base64");
      
      if (resizedBase64.length <= maxBase64Size) {
        console.log(`Image compressed: ${originalWidth}x${originalHeight} -> ${attempt.width}px @ ${attempt.quality}% quality`);
        console.log(`Size: ${originalSize} -> ${resizedBase64.length} bytes (${Math.round(resizedBase64.length / originalSize * 100)}%)`);
        return { 
          data: resizedBase64, 
          compressed: true, 
          originalSize, 
          finalSize: resizedBase64.length 
        };
      }
    }
    
    // Last resort - very small thumbnail
    const thumbnail = await sharp(buffer)
      .resize(150, null, { fit: "inside" })
      .jpeg({ quality: 20 })
      .toBuffer();
    
    const thumbnailBase64 = thumbnail.toString("base64");
    console.log(`Image compressed to thumbnail: ${originalSize} -> ${thumbnailBase64.length} bytes`);
    
    return { 
      data: thumbnailBase64, 
      compressed: true, 
      originalSize, 
      finalSize: thumbnailBase64.length 
    };
    
  } catch (error) {
    console.error("Image compression failed:", error);
    // Return empty on error
    return { data: "", compressed: true, originalSize, finalSize: 0 };
  }
}

async function processPayload(feature: FeaturePayload): Promise<FeaturePayload & { imageInfo?: any }> {
  // Create a copy without screenshots first to check size
  const withoutScreenshots = { ...feature };
  delete withoutScreenshots.screenshots;
  delete withoutScreenshots.annotatedImage;
  
  const baseSize = JSON.stringify(withoutScreenshots).length;
  const availableForImages = Math.min(MAX_PAYLOAD_SIZE - baseSize - 2000, MAX_IMAGE_SIZE);
  
  const result: FeaturePayload & { imageInfo?: any } = { ...withoutScreenshots };
  
  // Prioritize annotated image, fallback to first screenshot
  let imageSource: string | undefined;
  let imageType: 'annotated' | 'screenshot' = 'screenshot';
  let imageUrl: string | undefined;
  
  if (feature.annotatedImage) {
    imageSource = feature.annotatedImage;
    imageType = 'annotated';
  } else if (feature.screenshots?.length && feature.screenshots[0]?.image) {
    imageSource = feature.screenshots[0].image;
    imageType = 'screenshot';
    imageUrl = feature.screenshots[0].url;
  }
  
  if (imageSource && availableForImages > 5000) {
    console.log(`Processing ${imageType} image (original: ${Math.round(imageSource.length / 1024)}KB, available: ${Math.round(availableForImages / 1024)}KB)`);
    
    const compressed = await compressImage(imageSource, availableForImages);
    
    result.imageInfo = {
      type: imageType,
      url: imageUrl,
      originalSize: compressed.originalSize,
      finalSize: compressed.finalSize,
      compressed: compressed.compressed,
      included: compressed.finalSize > 0
    };
    
    if (compressed.finalSize > 0) {
      // Image was successfully compressed, include it
      if (imageType === 'annotated') {
        result.annotatedImage = compressed.data;
      } else {
        result.screenshots = [{
          image: compressed.data,
          url: imageUrl
        }];
      }
      console.log(`✓ Image included (${Math.round(compressed.finalSize / 1024)}KB)`);
    } else {
      result.imageInfo.message = `Image compression failed`;
    }
  } else if (!imageSource) {
    result.imageInfo = {
      type: 'none',
      message: 'No image available for this feature'
    };
  } else {
    result.imageInfo = {
      type: imageType,
      message: `Not enough space for image (need ${Math.round(imageSource.length / 1024)}KB, have ${Math.round(availableForImages / 1024)}KB)`
    };
  }
  
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, repo, feature, apiKey } = body;

    if (!token || !repo) {
      return NextResponse.json(
        { error: "GitHub token and repository are required" },
        { status: 400 }
      );
    }

    if (!feature || !feature.title) {
      return NextResponse.json(
        { error: "Feature specification is required" },
        { status: 400 }
      );
    }

    // Prepare the payload with image compression
    const processedFeature = await processPayload(feature);
    
    // Build the client_payload for repository_dispatch
    const clientPayload: Record<string, any> = {
      feature: processedFeature,
      triggered_at: new Date().toISOString(),
      source: "treeminspls"
    };

    // Include API key in payload if provided (note: will be visible in Actions logs)
    // For better security, users should add GEMINI_API_KEY to repo secrets
    if (apiKey) {
      clientPayload.api_key = apiKey;
    }

    // Check final payload size
    let payloadString = JSON.stringify(clientPayload);
    console.log(`Initial payload size: ${payloadString.length} bytes`);
    
    // Log image info
    if (processedFeature.imageInfo) {
      console.log(`Image info:`, processedFeature.imageInfo);
    }
    
    if (payloadString.length > MAX_PAYLOAD_SIZE) {
      // Further truncate - remove all images as last resort
      console.log(`Payload too large, removing images...`);
      delete clientPayload.feature.screenshots;
      delete clientPayload.feature.annotatedImage;
      clientPayload.feature.imageInfo = {
        type: 'removed',
        message: 'Image removed due to payload size limits'
      };
      payloadString = JSON.stringify(clientPayload);
      console.log(`Final payload size: ${payloadString.length} bytes`);
    }

    console.log(`Triggering repository_dispatch for ${repo}...`);
    console.log(`Event type: generate-code`);
    
    // Trigger the repository_dispatch event
    const response = await fetch(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          event_type: "generate-code",
          client_payload: clientPayload
        })
      }
    );

    console.log(`GitHub response status: ${response.status}`);

    // GitHub returns 204 No Content on success
    if (response.status === 204) {
      console.log("✓ Dispatch successful");
    } else if (!response.ok) {
      const errorText = await response.text();
      console.error(`GitHub API error: ${response.status}`, errorText);
      
      let errorMessage = `GitHub API error: ${response.status}`;
      let hint = "";
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      // Add helpful hints based on error
      if (response.status === 404) {
        hint = " - Make sure the repository exists and you have access. Also ensure you've clicked 'Setup Workflow' first.";
      } else if (response.status === 401 || response.status === 403) {
        hint = " - Check that your Personal Access Token has 'repo' scope permissions.";
      } else if (response.status === 422) {
        hint = " - The workflow file may not exist in the repository. Click 'Setup Workflow' on the GitHub integration page.";
      }
      
      return NextResponse.json(
        { error: errorMessage + hint }, 
        { status: response.status }
      );
    }

    // Get the Actions URL for the user to check
    const actionsUrl = `https://github.com/${repo}/actions`;

    return NextResponse.json({
      success: true,
      message: "Workflow triggered successfully! Check GitHub Actions for progress.",
      actionsUrl,
      feature: {
        title: processedFeature.title,
        type: processedFeature.type
      }
    });

  } catch (error: any) {
    console.error("Trigger error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trigger workflow" },
      { status: 500 }
    );
  }
}

