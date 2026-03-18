# 🌲 treeminspls

AI-powered UX analysis tool that generates persona-based website feedback and actionable feature recommendations.

## Overview

treeminspls uses AI agents to automatically navigate your website as a specific user persona, collecting UX critiques and generating detailed improvement recommendations. It can even create GitHub Pull Requests with AI-generated code fixes.

## Features

- **🎭 Persona-Based Analysis** - Define a user persona and watch the AI agent browse your site from their perspective
- **🤖 Visual Agent** - Automated browser navigation with real-time screenshot capture
- **📊 UX Synthesis** - AI-generated summary with UX scores, strengths, and weaknesses
- **💡 Feature Recommendations** - Actionable feature/bugfix proposals with technical specs
- **🔗 GitHub Integration** - Automatically trigger GitHub Actions to generate code and create PRs

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui
- **AI**: Google Gemini (2.5 Flash, 3.0 Gemini Pro, 3.0 Gemini Pro Image Preview)
- **Browser Automation**: Playwright
- **CI/CD**: GitHub Actions for automated code generation

## Getting Started

### Prerequisites

- Node.js 20+
- Google Gemini API Key
- (Optional) GitHub Personal Access Token for PR automation

### Installation

```bash
# Clone the repository
git clone https://github.com/w3joe/treeminspls.git
cd treeminspls

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file:

```env
GOOGLE_API_KEY=your_gemini_api_key
# or
GEMINI_API_KEY=your_gemini_api_key
```

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### 1. Configure GitHub Integration (Optional)

Navigate to `/github` to set up:
- GitHub Personal Access Token
- Repository (username/repo)
- Deployed Website URL
- (Optional) Gemini API Key for workflows

### 2. Start Analysis

1. Enter a **persona description** (e.g., "A 30-year-old developer looking for a project management tool")
2. Click **Start Analysis**

### 3. Visual Agent Testing

- Watch the AI agent navigate your site
- View real-time screenshots and agent logs
- The sitemap visualization shows visited pages

### 4. Generate Final Report

- **UX Summary**: Overall score, strengths, and weaknesses
- **Feature Proposals**: Detailed recommendations with technical specs
- **Create PR**: (If GitHub connected) Trigger automated code generation

## Project Structure

```
treeminspls/
├── app/
│   ├── api/
│   │   ├── analyze/      # Persona analysis endpoint
│   │   ├── navigate/     # Visual agent browser automation
│   │   ├── synthesize/   # UX synthesis & recommendations
│   │   ├── sitemap/      # Sitemap generation
│   │   └── github/       # GitHub integration APIs
│   ├── github/           # GitHub settings page
│   └── result/           # Analysis results page
├── components/
│   ├── PersonaGenerator.tsx
│   ├── ScreenshotCard.tsx
│   ├── SitemapVisualizer.tsx
│   ├── FeedbackSummary.tsx
│   ├── FeatureProposals.tsx
│   └── ui/               # shadcn/ui components
└── lib/
    └── hooks/            # Custom React hooks
```

## How It Works

1. **Persona Generation**: AI creates a detailed user profile based on your description
2. **Visual Agent**: Playwright-powered browser navigates your site, taking screenshots and generating critiques
3. **Synthesis**: Gemini analyzes all critiques and generates a comprehensive UX report
4. **Code Generation**: (Optional) GitHub Actions workflow uses Gemini to generate code and create PRs

## API Cost Considerations

The app uses Google Gemini APIs. To manage costs:
- Vision analysis and image generation can be toggled in `app/api/synthesize/route.ts`
- Feature count is configurable (default: 2 recommendations)

## License

MIT

---

Built with 🌲 by treeminspls

