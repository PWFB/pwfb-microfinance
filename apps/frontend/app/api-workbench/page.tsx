"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApiWorkbenchPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/api-workbench/search");
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="pwfb-panel text-center">
        <p className="pwfb-eyebrow">PWFB CONTROL CENTER</p>
        <h1 className="pwfb-page-title">Opening API Workbench…</h1>
        <p className="pwfb-page-description">Loading the structured API search and developer workspace.</p>
      </div>
    </main>
  );
}
