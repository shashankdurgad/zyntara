"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SitemapVisualizer } from "@/components/SitemapVisualizer";

function SitemapContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");

  return (
    <div className="h-screen w-full bg-background p-4">
       <SitemapVisualizer url={url || ""} />
    </div>
  );
}

export default function SitemapPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading...</div>}>
            <SitemapContent />
        </Suspense>
    )
}


