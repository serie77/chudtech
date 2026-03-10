"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getTheme } from "@/utils/themes";
import { storeGet, storeSet } from "@/lib/store";
import ImageBrowser, { type ImageFile } from "./ImageBrowser";
import TokenSearch, { type TokenResult } from "./TokenSearch";

interface Panel2Props {
  themeId: string;
  filterText: string;
  onImageSelected: (imageUrl: string) => void;
  selectedImagePath: string | null;
  onTokenSelected: (token: TokenResult) => void;
  onTokenImageOnly: (imageUrl: string) => void;
  onSearchImages?: (imageUrls: string[]) => void;
  onOpenSettings: () => void;
  onBrowserImagesLoaded?: (images: ImageFile[]) => void;
  tokenSearchQuery?: string;
}

type Panel2Tab = "search" | "images" | "both";

export default function Panel2({
  themeId,
  filterText,
  onImageSelected,
  selectedImagePath,
  onTokenSelected,
  onTokenImageOnly,
  onSearchImages,
  onOpenSettings,
  onBrowserImagesLoaded,
  tokenSearchQuery,
}: Panel2Props) {
  const theme = getTheme(themeId);

  const [activeTab, setActiveTab] = useState<Panel2Tab>(() => {
    if (typeof window !== "undefined") {
      const saved = storeGet("panel2-tab");
      if (saved === "search" || saved === "images" || saved === "both") return saved;
    }
    return "both";
  });
  useEffect(() => {
    storeSet("panel2-tab", activeTab);
  }, [activeTab]);

  // Split height for "both" mode
  const [topHeight, setTopHeight] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = storeGet("panel2-split");
    if (saved) {
      try {
        const val = JSON.parse(saved);
        if (typeof val === "number" && val >= 10 && val <= 90) setTopHeight(val);
      } catch {}
    }
  }, []);

  const saveSplit = useCallback((top: number) => {
    storeSet("panel2-split", JSON.stringify(top));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setTopHeight(Math.max(10, Math.min(90, pct)));
    };
    const handleMouseUp = () => { setDragging(false); saveSplit(topHeight); };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, topHeight, saveSplit]);

  const tabs: { id: Panel2Tab; label: string }[] = [
    { id: "search", label: "Search" },
    { id: "images", label: "Images" },
    { id: "both", label: "Both" },
  ];

  return (
    <div ref={containerRef} className={`h-full ${theme.panel1ContentBg} flex flex-col overflow-hidden select-none`}>
      {/* Tab bar */}
      <div className="panel-header flex items-center" style={{ padding: 0 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? "text-white/60 border-b border-blue-500/50"
                : "text-white/25 hover:text-white/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "search" && (
        <div className="flex-1 overflow-hidden">
          <TokenSearch
            themeId={themeId}
            onTokenSelected={onTokenSelected}
            onImageOnly={onTokenImageOnly}
            onSearchImages={onSearchImages}
            externalQuery={tokenSearchQuery}
          />
        </div>
      )}

      {activeTab === "images" && (
        <div className="flex-1 overflow-hidden">
          <ImageBrowser
            themeId={themeId}
            filterText={filterText}
            onImageSelected={onImageSelected}
            selectedImagePath={selectedImagePath}
            onImagesLoaded={onBrowserImagesLoaded}
          />
        </div>
      )}

      {activeTab === "both" && (
        <>
          <div style={{ height: `${topHeight}%` }} className="flex-shrink-0 overflow-hidden">
            <TokenSearch
              themeId={themeId}
              onTokenSelected={onTokenSelected}
              onImageOnly={onTokenImageOnly}
              onSearchImages={onSearchImages}
              externalQuery={tokenSearchQuery}
            />
          </div>
          <div
            className={`splitter-h flex-shrink-0 cursor-row-resize ${dragging ? "splitter-active" : ""}`}
            onMouseDown={() => setDragging(true)}
          />
          <div style={{ height: `${100 - topHeight}%` }} className="flex-shrink-0 overflow-hidden">
            <ImageBrowser
              themeId={themeId}
              filterText={filterText}
              onImageSelected={onImageSelected}
              selectedImagePath={selectedImagePath}
              onImagesLoaded={onBrowserImagesLoaded}
            />
          </div>
        </>
      )}
    </div>
  );
}
