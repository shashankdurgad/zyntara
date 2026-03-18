import { NextRequest, NextResponse } from "next/server";
import { parseStringPromise } from "xml2js";

interface SitemapEntry {
  loc: string[];
}

interface SitemapUrlSet {
  urlset: {
    url: SitemapEntry[];
  };
}

import { load } from "cheerio";

// ... existing imports

interface TreeNode {
  name: string;
  path: string;
  description?: string;
  children: TreeNode[];
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Naive sitemap discovery: try /sitemap.xml
    const targetUrl = new URL(url);
    const sitemapUrl = `${targetUrl.protocol}//${targetUrl.hostname}/sitemap.xml`;

    console.log(`Fetching sitemap from: ${sitemapUrl}`);
    const response = await fetch(sitemapUrl);
    
    if (!response.ok) {
       return NextResponse.json({ error: `Could not fetch sitemap from ${sitemapUrl}. Status: ${response.status}` }, { status: 404 }); 
    }

    const xmlText = await response.text();
    const result = (await parseStringPromise(xmlText)) as SitemapUrlSet;

    if (!result.urlset || !result.urlset.url) {
        return NextResponse.json({ error: "Invalid sitemap format or no URLs found" }, { status: 422 });
    }

    const urls = result.urlset.url.map((entry) => entry.loc[0]);
    
    // Metadata scraping for top 10 URLs to keep it fast
    const descriptions: Record<string, string> = {};
    const subSetUrls = urls.slice(0, 10);

    await Promise.all(subSetUrls.map(async (u) => {
        try {
            const pageRes = await fetch(u, { signal: AbortSignal.timeout(3000) }); // 3s timeout
            if (pageRes.ok) {
                const html = await pageRes.text();
                const $ = load(html);
                const metaDesc = $('meta[name="description"]').attr('content') || 
                                 $('meta[property="og:description"]').attr('content');
                if (metaDesc) {
                    descriptions[u] = metaDesc;
                }
            }
        } catch (e) {
            console.error(`Failed to fetch metadata for ${u}`, e);
        }
    }));
    
    // Transform flat URLs into a tree
    const root: TreeNode = { name: targetUrl.hostname, path: "/", children: [] };
    
    urls.forEach((u) => {
        try {
            const parsed = new URL(u);
            const  parts = parsed.pathname.split("/").filter(Boolean);
            const desc = descriptions[u];
            
            let current = root;
            parts.forEach((part, index) => {
                let child = current.children.find(c => c.name === part);
                if (!child) {
                    // Only attach description to the leaf node (last part)
                    const isLeaf = index === parts.length - 1;
                    child = { 
                        name: part, 
                        path: part, 
                        children: [],
                        description: isLeaf ? desc : undefined 
                    };
                    current.children.push(child);
                }
                current = child;
            });
        } catch (e) {
            // Ignore invalid URLs in sitemap
        }
    });

    return NextResponse.json({ tree: root });
  } catch (error: any) {
    console.error("Sitemap error:", error);
    return NextResponse.json(
      { error: "Failed to process sitemap", details: error.message },
      { status: 500 }
    );
  }
}
