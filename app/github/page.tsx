"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Github, Check, X, Loader2, Settings, FolderGit2, Sparkles, Trash2 } from "lucide-react";

interface GitHubSettings {
  token: string;
  repo: string;
  branch: string;
  geminiApiKey?: string; // Optional: Pass to workflow, or use repo secret
  websiteUrl?: string; // The deployed website URL to analyze
  connected?: boolean;
  workflowSetup?: boolean;
  repoUrl?: string;
  repoName?: string;
  connectedAt?: string;
  workflowSetupAt?: string;
}

export default function GitHubPage() {
  const [settings, setSettings] = useState<GitHubSettings>({
    token: "",
    repo: "",
    branch: "main"
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isWorkflowSetup, setIsWorkflowSetup] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [setupResult, setSetupResult] = useState<{ success: boolean; message: string } | null>(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("treeminspls_github");
    if (stored) {
      const parsed = JSON.parse(stored);
      setSettings(parsed);
      // Restore connected and workflow status from storage
      if (parsed.connected) {
        setIsConnected(true);
      }
      if (parsed.workflowSetup) {
        setIsWorkflowSetup(true);
      }
      // Auto-test connection if settings exist
      if (parsed.token && parsed.repo) {
        testConnection(parsed);
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = () => {
    localStorage.setItem("treeminspls_github", JSON.stringify(settings));
  };

  // Clear all settings and disconnect
  const clearSettings = () => {
    if (confirm("Are you sure you want to disconnect from GitHub?\n\nThis will clear all saved settings.")) {
      localStorage.removeItem("treeminspls_github");
      setSettings({ token: "", repo: "", branch: "main" });
      setIsConnected(false);
      setIsWorkflowSetup(false);
      setTestResult(null);
      setSetupResult(null);
    }
  };

  // Test GitHub connection
  const testConnection = async (settingsToTest?: GitHubSettings) => {
    const s = settingsToTest || settings;
    if (!s.token || !s.repo) {
      setTestResult({ success: false, message: "Please enter both token and repository" });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s)
      });

      const data = await res.json();
      
      if (res.ok) {
        setIsConnected(true);
        setIsWorkflowSetup(data.workflowExists);
        setTestResult({ success: true, message: data.message });
        // Save with all connection info for persistence
        const updatedSettings = { 
          ...s, 
          connected: true, 
          workflowSetup: data.workflowExists,
          repoUrl: `https://github.com/${s.repo}`,
          repoName: s.repo,
          connectedAt: new Date().toISOString()
        };
        localStorage.setItem("treeminspls_github", JSON.stringify(updatedSettings));
      } else {
        setIsConnected(false);
        setIsWorkflowSetup(false);
        // Clear connected flag on failure
        localStorage.setItem("treeminspls_github", JSON.stringify({ ...s, connected: false, workflowSetup: false }));
        setTestResult({ success: false, message: data.error });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setIsTesting(false);
    }
  };

  // Setup workflow files in repo
  const setupWorkflow = async () => {
    if (!settings.token || !settings.repo) {
      setSetupResult({ success: false, message: "Please connect to GitHub first" });
      return;
    }

    setIsSettingUp(true);
    setSetupResult(null);

    try {
      const res = await fetch("/api/github/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });

      const data = await res.json();
      
      if (res.ok) {
        setIsWorkflowSetup(true);
        setSetupResult({ success: true, message: data.message });
        // Update localStorage with workflow status
        const stored = localStorage.getItem("treeminspls_github");
        if (stored) {
          const current = JSON.parse(stored);
          localStorage.setItem("treeminspls_github", JSON.stringify({
            ...current,
            workflowSetup: true,
            workflowSetupAt: new Date().toISOString()
          }));
        }
      } else {
        setSetupResult({ success: false, message: data.error });
      }
    } catch (error: any) {
      setSetupResult({ success: false, message: error.message });
    } finally {
      setIsSettingUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Github className="w-8 h-8" />
              GitHub Integration
            </h1>
            <p className="text-muted-foreground">
              Connect your repository to auto-generate code from UX analysis
            </p>
          </div>
        </div>

        {/* Connection Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Repository Settings
            </CardTitle>
            <CardDescription>
              Enter your GitHub Personal Access Token and repository details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Personal Access Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={settings.token}
                onChange={(e) => setSettings({ ...settings, token: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Create a token at{" "}
                <a 
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  GitHub Settings
                </a>
                {" "}with <code className="bg-muted px-1 rounded">repo</code> and <code className="bg-muted px-1 rounded">workflow</code> scopes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repo">Repository</Label>
              <Input
                id="repo"
                placeholder="owner/repository-name"
                value={settings.repo}
                onChange={(e) => setSettings({ ...settings, repo: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Format: <code className="bg-muted px-1 rounded">username/repo</code> or <code className="bg-muted px-1 rounded">org/repo</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Default Branch</Label>
              <Input
                id="branch"
                placeholder="main"
                value={settings.branch}
                onChange={(e) => setSettings({ ...settings, branch: e.target.value })}
              />
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="websiteUrl">Deployed Website URL</Label>
              <Input
                id="websiteUrl"
                placeholder="https://your-app.vercel.app"
                value={settings.websiteUrl || ""}
                onChange={(e) => setSettings({ ...settings, websiteUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                The live URL of the website you want to analyze with the UX agent
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="geminiApiKey">Gemini API Key (Optional)</Label>
              <Input
                id="geminiApiKey"
                type="password"
                placeholder="AIzaSy..."
                value={settings.geminiApiKey || ""}
                onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                <strong>Option 1:</strong> Enter here to pass with each trigger (visible in Actions logs)<br/>
                <strong>Option 2 (Recommended):</strong> Add <code className="bg-muted px-1 rounded">GEMINI_API_KEY</code> to your{" "}
                <a 
                  href={settings.repo ? `https://github.com/${settings.repo}/settings/secrets/actions` : "#"}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  repository secrets
                </a>
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="flex items-center gap-2">
              {testResult && (
                <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  {testResult.message}
                </div>
              )}
            </div>
            <Button onClick={() => testConnection()} disabled={isTesting}>
              {isTesting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testing...</>
              ) : (
                <>Test Connection</>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Setup Workflow Card - Only show if connected */}
        {isConnected && (
          <Card className={isWorkflowSetup ? "border-green-200 bg-green-50/50" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5" />
                Workflow Setup
                {isWorkflowSetup && <Check className="w-5 h-5 text-green-600" />}
              </CardTitle>
              <CardDescription>
                {isWorkflowSetup 
                  ? "GitHub Actions workflow is configured in your repository"
                  : "Set up the auto-code generation workflow in your repository"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isWorkflowSetup ? (
                <div className="space-y-4">
                  <div className="text-sm text-green-700 bg-green-100 p-4 rounded-lg">
                    <p className="font-medium mb-2">✓ Workflow is ready!</p>
                    <p>When you export features, they will be pushed to your repo and the workflow will automatically:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Read the feature specification</li>
                      <li>Generate code using Gemini AI</li>
                      <li>Create a Pull Request for review</li>
                    </ul>
                  </div>
                  
                  {/* Update Workflow Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Update Workflow Files</p>
                        <p>Push the latest workflow configuration to your repository</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={setupWorkflow}
                        disabled={isSettingUp}
                        className="gap-2"
                      >
                        {isSettingUp ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
                        ) : (
                          <><Sparkles className="w-4 h-4" /> Update Workflow</>
                        )}
                      </Button>
                    </div>
                    {setupResult && (
                      <div className={`mt-2 flex items-center gap-2 text-sm ${setupResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {setupResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {setupResult.message}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p className="mb-4">This will create the following files in your repository:</p>
                  <ul className="space-y-2 font-mono text-xs bg-muted p-4 rounded-lg">
                    <li>📁 .github/workflows/auto-code-gen.yml</li>
                    <li>📁 .github/scripts/generate-code.js</li>
                    <li>📁 features/bugs/.gitkeep</li>
                    <li>📁 features/new-features/.gitkeep</li>
                  </ul>
                  <p className="mt-4 text-amber-600">
                    ⚠️ Don't forget to add <code className="bg-amber-100 px-1 rounded">GEMINI_API_KEY</code> to your repository secrets!
                  </p>
                </div>
              )}
            </CardContent>
            {!isWorkflowSetup && (
              <CardFooter className="flex justify-between">
                <div className="flex items-center gap-2">
                  {setupResult && (
                    <div className={`flex items-center gap-2 text-sm ${setupResult.success ? 'text-green-600' : 'text-red-600'}`}>
                      {setupResult.success ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {setupResult.message}
                    </div>
                  )}
                </div>
                <Button onClick={setupWorkflow} disabled={isSettingUp}>
                  {isSettingUp ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" /> Setup Workflow</>
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        )}

        {/* Status Summary */}
        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>GitHub Connection</span>
                  <span className="flex items-center gap-2 text-green-600">
                    <Check className="w-4 h-4" /> Connected
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Repository</span>
                  <a 
                    href={`https://github.com/${settings.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {settings.repo}
                  </a>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Website URL</span>
                  {settings.websiteUrl ? (
                    <a 
                      href={settings.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline truncate max-w-[200px]"
                    >
                      {settings.websiteUrl}
                    </a>
                  ) : (
                    <span className="text-amber-600">Not configured</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span>Workflow Status</span>
                  {isWorkflowSetup ? (
                    <span className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" /> Ready
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-amber-600">
                      <X className="w-4 h-4" /> Not configured
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" asChild className="flex-1">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Analysis
                </Link>
              </Button>
              <Button 
                variant="destructive" 
                onClick={clearSettings}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Disconnect
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

