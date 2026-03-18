import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, repo, branch, feature } = await req.json();

    if (!token || !repo || !feature) {
      return NextResponse.json({ 
        error: "Token, repository, and feature data are required" 
      }, { status: 400 });
    }

    // Generate filename from title
    const filename = feature.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const timestamp = Date.now();
    const folder = feature.type === 'bugfix' ? 'bugs' : 'new-features';
    const filePath = `features/${folder}/${filename}-${timestamp}.json`;

    // Prepare feature spec JSON
    const featureSpec = {
      type: feature.type === 'bugfix' ? 'bug_fix' : 'feature',
      title: feature.title,
      description: feature.description,
      spec: feature.spec,
      screenshots: feature.screenshotImage ? [{
        url: `data:image/jpeg;base64,${feature.screenshotImage}`,
        caption: `Screenshot from ${feature.screenshotUrl || 'UX analysis'}`
      }] : [],
      affected_files: [], // User can fill this in later
      acceptance_criteria: [
        "Implementation matches the description",
        "No regressions introduced",
        "Code follows project conventions"
      ],
      priority: "medium",
      estimated_complexity: "medium",
      source: {
        tool: "treeminspls",
        timestamp: new Date().toISOString(),
        screenshotUrl: feature.screenshotUrl,
        screenshotTitle: feature.screenshotTitle
      }
    };

    const content = JSON.stringify(featureSpec, null, 2);

    // Create file in repository
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        },
        body: JSON.stringify({
          message: `feat: Add ${feature.type} spec - ${feature.title}`,
          content: Buffer.from(content).toString("base64"),
          branch
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ 
        error: error.message || "Failed to push to repository" 
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: `Feature spec pushed to ${filePath}`,
      filePath,
      commitUrl: data.commit?.html_url,
      fileUrl: data.content?.html_url
    });

  } catch (error: any) {
    console.error("Push error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

