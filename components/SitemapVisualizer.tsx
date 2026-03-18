"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Loader2, ChevronRight, ChevronDown, PanelLeftOpen, PanelLeftClose, TreePine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
    loading: () => <p>Loading graph engine...</p>
});

interface TreeNode {
    name: string;
    path: string;
    description?: string;
    children: TreeNode[];
}

interface GraphNode {
    id: string;
    name: string;
    description?: string;
    group: number;
    val: number; // radius
    color?: string;
}

interface GraphLink {
    source: string;
    target: string;
}

interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

interface SitemapVisualizerProps {
    url: string;
    visitedPaths?: string[];
}

// Helper: Hex to RGBA with depth-based opacity
function getFadedColor(hex: string, depth: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Opacity starts at 1, decays 12% per level, floor at 0.2
    const opacity = Math.max(0.2, 1 - depth * 0.12);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function SitemapVisualizer({ url, visitedPaths = [] }: SitemapVisualizerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [treeData, setTreeData] = useState<TreeNode | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default collapsed

    // Resize logic
    const containerRef = useRef<HTMLDivElement>(null);
    const graphRef = useRef<any>(null); // Ref to access ForceGraph methods
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;

        // Initial size
        setDimensions({
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight
        });

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setDimensions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [loading, treeData]);

    useEffect(() => {
        if (!url) return;

        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch("/api/sitemap", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url }),
                });

                if (!res.ok) throw new Error("Failed to fetch sitemap");

                const data = await res.json();
                if (!data.tree) throw new Error("No sitemap tree returned");

                setTreeData(data.tree);
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Something went wrong");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [url]);

    // Transform hierarchical tree data to flat graph data
    const graphData = useMemo<GraphData | null>(() => {
        if (!treeData) return null;

        const nodes: GraphNode[] = [];
        const links: GraphLink[] = [];

        const traverse = (node: TreeNode, parentId?: string, depth: number = 0) => {
            const id = node.path;

            // Color generation logic
            let color;

            // Robust Matching
            const cleanUrl = (u: string) => u.replace(/\/$/, "").toLowerCase();
            const fullNodeUrl = url.replace(/\/$/, "") + (id.startsWith("/") ? id : `/${id}`);

            const isVisited = visitedPaths.some(vp => {
                const v = cleanUrl(vp);
                // Match against relative path (id), absolute constructed url, or just checking if visited url ends with id
                return v === cleanUrl(id) || v === cleanUrl(fullNodeUrl) || v.endsWith(cleanUrl(id));
            });

            if (isVisited) {
                color = "#0891b2"; // Cyan-600 (Darker Cyan for light bg)
            } else {
                // Darker palette for light background contrast
                const colors = ['#ef4444', '#d97706', '#059669', '#2563eb', '#7c3aed']; // Red, Amber, Emerald, Blue, Violet (600s)
                const hex = colors[depth % colors.length];
                color = getFadedColor(hex, depth);
            }

            nodes.push({
                id: id,
                name: node.name,
                description: node.description,
                group: depth,
                val: depth === 0 ? 10 : 5,
                color: color
            });

            if (parentId) {
                links.push({
                    source: parentId,
                    target: id
                });
            }

            node.children.forEach(child => traverse(child, id, depth + 1));
        };

        traverse(treeData);

        return { nodes, links };
    }, [treeData, visitedPaths, url]); // Proper dependencies

    const handleNodeClick = (nodeId: string) => {
        if (!graphRef.current || !graphData) return;

        const node = graphData.nodes.find(n => n.id === nodeId);
        if (node) {
            // Center the camera on the node
            graphRef.current.centerAt((node as any).x, (node as any).y, 1000);
            graphRef.current.zoom(6, 2000);
        }
    };

    // Recursive Collapsible Tree Component
    const CollapsibleTreeNode = ({ node, depth = 0 }: { node: TreeNode, depth?: number }) => {
        const [isOpen, setIsOpen] = useState(depth === 0); // Root open by default
        const hasChildren = node.children && node.children.length > 0;

        const handleToggle = (e: React.MouseEvent) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
        };

        const handleClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            handleNodeClick(node.path);
        };

        const indent = depth * 12; // Pixel indent

        return (
            <div className="select-none">
                <div
                    className={`flex items-center group py-1 px-2 rounded cursor-pointer transition-colors ${
                        // Highlight logic could go here
                        "hover:bg-muted/50"
                        }`}
                    style={{ marginLeft: `${indent}px` }}
                    onClick={handleClick}
                >
                    {/* Toggle Button */}
                    <div
                        className={`mr-1 p-0.5 rounded-sm hover:bg-muted text-muted-foreground ${hasChildren ? "opacity-100" : "opacity-0"}`}
                        onClick={hasChildren ? handleToggle : undefined}
                    >
                        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </div>

                    {/* Label */}
                    <span className="font-mono text-xs truncate text-foreground/80 group-hover:text-primary">
                        {node.name}
                    </span>
                </div>

                {/* Children */}
                {isOpen && hasChildren && (
                    <div>
                        {node.children.map((child, i) => (
                            <CollapsibleTreeNode key={`${child.path}-${i}`} node={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Helper for checking if a path is visited (Reusable)
    const isNodeVisited = (nodeId: string) => {
        const normalize = (p: string) => p.replace(/\/$/, "").toLowerCase();
        // We need to handle relative IDs vs absolute URLs consistent with previous logic
        // Note: We might need to look up if the node ID corresponds to a visited path
        // Logic from useMemo:
        const fullNodeUrl = url.replace(/\/$/, "") + (nodeId.startsWith("/") ? nodeId : `/${nodeId}`);

        return (visitedPaths || []).some(vp => {
            const v = normalize(vp);
            return v === normalize(nodeId) || v === normalize(fullNodeUrl) || v.endsWith(normalize(nodeId));
        });
    };

    return (
        <Card className="h-full flex flex-col shadow-lg border">
            <CardHeader className="border-b bg-primary/5 pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                    <TreePine className="w-5 h-5 text-primary" />
                    Site Structure
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex flex-1 items-center justify-center flex-col gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground">Scanning sitemap...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-1 items-center justify-center">
                        <p className="text-destructive font-bold">Error: {error}</p>
                    </div>
                ) : (
                    <div className="flex flex-1 h-full overflow-hidden relative">
                        {/* Text Tree Sidebar - Collapsible */}
                        <div
                            className={`h-full border-r bg-slate-50 overflow-y-auto max-h-full transition-all duration-300 ease-in-out absolute z-20 shadow-xl ${isSidebarOpen ? "w-1/3 min-w-[250px] translate-x-0" : "w-0 -translate-x-full border-none"
                                }`}
                        >
                            <div className="p-4 pt-12 w-[250px] sm:w-[33vw]"> {/* Fixed width inner container with top clearance */}
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Hierarchy</h4>
                                </div>
                                {treeData && <CollapsibleTreeNode node={treeData} />}
                            </div>
                        </div>

                        {/* Main Graph Area - Light Background */}
                        <div ref={containerRef} className="flex-1 h-full bg-white border-l relative overflow-hidden transition-all duration-300">
                            {/* Sidebar Toggle Button (Persistent) */}
                            <Button
                                variant={isSidebarOpen ? "secondary" : "outline"}
                                size="sm"
                                className="absolute top-2 left-2 z-30 shadow-sm gap-2 bg-white/90 hover:bg-white"
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            >
                                {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                                <span className="text-xs">{isSidebarOpen ? "Close" : "Tree"}</span>
                            </Button>

                            {graphData && dimensions.width > 0 && (
                                <ForceGraph2D
                                    ref={graphRef}
                                    graphData={graphData}
                                    // nodeLabel is shown on hover. Show description if available, else name.
                                    nodeLabel={(node: any) => node.description ? `${node.name}\n${node.description}` : node.name}

                                    // Dynamic Link Styling
                                    linkColor={(link: any) => {
                                        // ReactForceGraph mutates links to objects, but initially they are IDs. 
                                        // Safely access ID
                                        const sourceId = link.source.id || link.source;
                                        const targetId = link.target.id || link.target;

                                        if (isNodeVisited(sourceId) && isNodeVisited(targetId)) {
                                            return "#0891b2"; // Cyan-600
                                        }
                                        return "#cbd5e1"; // Slate-300
                                    }}
                                    linkWidth={(link: any) => {
                                        const sourceId = link.source.id || link.source;
                                        const targetId = link.target.id || link.target;

                                        if (isNodeVisited(sourceId) && isNodeVisited(targetId)) {
                                            return 3; // Thicker line
                                        }
                                        return 1;
                                    }}

                                    backgroundColor="#ffffff"
                                    width={dimensions.width}
                                    height={dimensions.height}

                                    onNodeClick={(node) => handleNodeClick(node.id as string)}
                                    onNodeHover={(node) => {
                                        if (containerRef.current) {
                                            containerRef.current.style.cursor = node ? 'pointer' : 'default';
                                        }
                                    }}
                                    nodeCanvasObject={(node: any, ctx, globalScale) => {
                                        const label = node.name;
                                        const fontSize = 12 / globalScale;
                                        ctx.font = `${fontSize}px Sans-Serif`;

                                        // Draw node circle
                                        ctx.beginPath();
                                        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
                                        ctx.fillStyle = node.color || '#000';
                                        ctx.fill();

                                        // Draw text label - Dark text for light bg
                                        const depth = node.group;
                                        // Text opacity: prevent it from disappearing completely on white
                                        const textOpacity = Math.max(0.7, 1 - depth * 0.1);

                                        ctx.textAlign = 'center';
                                        ctx.textBaseline = 'middle';
                                        ctx.fillStyle = `rgba(0, 0, 0, ${textOpacity})`; // Black text
                                        ctx.fillText(label, node.x, node.y + node.val + fontSize + 2); // Below the node
                                    }}
                                />
                            )}
                            <div className="absolute top-2 right-2 bg-white/90 border shadow-sm text-xs text-muted-foreground p-2 rounded pointer-events-none">
                                Scroll to Zoom • Drag to Move • Click Text to Focus
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
