"use client";

import dynamic from "next/dynamic";
import AuthGate from "@/components/AuthGate";

// Lazy-load the entire app — nothing is bundled/fetched until authenticated
const ResizablePanels = dynamic(() => import("@/components/ResizablePanels"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  ),
});

export default function Home() {
  return (
    <AuthGate>
      <ResizablePanels />
    </AuthGate>
  );
}
