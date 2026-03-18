import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { token, repo, branch } = await req.json();

    if (!token || !repo) {
      return NextResponse.json({ error: "Token and repository are required" }, { status: 400 });
    }

    // Test GitHub API connection
    const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!repoResponse.ok) {
      const error = await repoResponse.json();
      return NextResponse.json({ 
        error: error.message || "Failed to access repository" 
      }, { status: repoResponse.status });
    }

    const repoData = await repoResponse.json();

    // Check if workflow file exists
    const workflowResponse = await fetch(
      `https://api.github.com/repos/${repo}/contents/.github/workflows/auto-code-gen.yml?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    const workflowExists = workflowResponse.ok;

    return NextResponse.json({
      success: true,
      message: `Connected to ${repoData.full_name}`,
      repoName: repoData.full_name,
      defaultBranch: repoData.default_branch,
      workflowExists
    });

  } catch (error: any) {
    console.error("GitHub connection error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

