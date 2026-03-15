"use client";

import { useState, useRef, useEffect, useCallback, useMemo, Fragment, startTransition, lazy, Suspense } from "react";
import Panel1 from "./Panel1";
import TokenSearch, { type TokenResult } from "./TokenSearch";
import ImageBrowser, { type ImageFile } from "./ImageBrowser";
import Panel3 from "./Panel3";
import Canvas from "./Canvas";
import { Settings, Home, Eye, Bookmark, Search, Users, Zap, SlidersHorizontal, Pencil, RotateCcw, LogOut } from "lucide-react";
import SettingsModal from "./SettingsModal";
import DeploySettingsModal from "./DeploySettingsModal";
import ImageLibraryModal from "./ImageLibraryModal";
import VampModal, { type VampData } from "./VampModal";

// Lazy-load Launchblitz layout — only fetched when user selects it
const LaunchblitzLayout = lazy(() => import("./LaunchblitzLayout"));
import { getTheme } from "@/utils/themes";
import { Keyword } from "@/utils/highlightHelper";
import { useJ7Feed } from "@/hooks/useJ7Feed";
import { useBarkFeed } from "@/hooks/useBarkFeed";
import { generatePresetImage } from "@/utils/imageGenerator";
import { storeGet, storeSet, storeRemove } from "@/lib/store";
import { getRegionKey } from "@/services/tokenApi";
import { Panel as ResizablePanel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// API Selection Toggle
const USE_BARK_API = true; // Set to false to use J7Tracker instead

// J7Tracker JWT Token
const J7_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5vbGFuIiwiaXAiOiI1MC4xMjYuMTMxLjIzMCIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjkxOTI4MDcsImV4cCI6MTc2OTc5NzYwN30.vCBXyP-S-CTe2n3z2nbvF8WFnuSJJqZme_AiYRAikXM';

// Bark.gg Token
const BARK_TOKEN = '7ea5ea3b456ff700d39927a80f9661e2dc9e612c84ee77207d48d4d1eb6a941d';

interface Wallet {
  id: string;
  type: 'solana' | 'evm';
  publicKey: string;
  privateKey: string;
  compositeKey: string;
  balance: number;
  isActive: boolean;
}

interface Tweet {
  id: string;
  twitterStatusId?: string; // Actual Twitter status ID for URL construction
  username: string;
  displayName: string;
  handle: string;
  verified: boolean;
  timestamp: string;
  text: string;
  imageUrl?: string;
  profilePic: string;
  highlightColor?: string;
  isRetweet?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
  tweetType?: string;
  platform?: 'twitter' | 'truthsocial' | 'x';
  media?: Array<{ type: 'image' | 'video' | 'gif'; url: string; thumbnail?: string }>;
  originalAuthorHandle?: string;
  quotedTweet?: Tweet;
  repliedToTweet?: Tweet;
  linkPreviews?: Array<{
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  }>;
  followedUser?: {
    handle: string;
    displayName: string;
    profilePic: string;
    bio?: string;
    followers?: string;
    url?: string;
  };
}
interface CustomNotification {
  id: string;
  username: string;
  color: string;
  sound: string;
}

function buildTweetUrl(username: string, statusId?: string): string {
  if (statusId) {
    const numericId = statusId.replace(/^[a-zA-Z-]+/, '');
    if (numericId && /^\d+$/.test(numericId)) {
      return `https://x.com/${username}/status/${numericId}`;
    }
  }
  return `https://x.com/${username}`;
}

interface ButtonConfig {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

interface CustomPreset {
  id: string;
  name: string;
  namePrefix: string;
  nameSuffix: string;
  deployPlatform: string;
  tickerMode: string;
  imageType: string;
  keybind: string;
  customImageUrl?: string;
}

interface PresetTriggerData {
  namePrefix: string;
  nameSuffix: string;
  deployPlatform: string;
  tickerMode: string;
  imageType: string;
  selectedText?: string;
  overrideTicker?: string;
  tweetImageUrl?: string;
  tweetLink?: string;
  customImageUrl?: string;
}

// ─── Drag handle for edit mode (must be outside component to avoid remounting) ───
function DragHandle({ panelId, draggedPanel, setDraggedPanel, setDragOverPanel }: {
  panelId: string;
  draggedPanel: string | null;
  setDraggedPanel: (v: string | null) => void;
  setDragOverPanel: (v: string | null) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => { setDraggedPanel(panelId); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', panelId); }}
      onDragEnd={() => { setDraggedPanel(null); setDragOverPanel(null); }}
      className={`h-5 flex-shrink-0 cursor-grab active:cursor-grabbing transition-all flex items-center justify-center gap-1.5 ${draggedPanel === panelId ? 'bg-blue-500/20' : 'bg-blue-500/[0.06] hover:bg-blue-500/[0.12]'} border-b border-blue-500/20`}
      title="Drag to reorder"
    >
      <div className="flex gap-[3px]">
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
      </div>
      <span className="text-[9px] font-medium text-blue-400/50 uppercase tracking-wider">{panelId}</span>
      <div className="flex gap-[3px]">
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
        <div className="w-[3px] h-[3px] rounded-full bg-blue-400/40" />
      </div>
    </div>
  );
}

// ─── Single panel wrapper with drag/drop support ───
function PanelWrapper({ panelId, editMode, draggedPanel, dragOverPanel, setDraggedPanel, setDragOverPanel, swapPanels, stackPanel, children }: {
  panelId: string;
  editMode: boolean;
  draggedPanel: string | null;
  dragOverPanel: string | null;
  setDraggedPanel: (v: string | null) => void;
  setDragOverPanel: (v: string | null) => void;
  swapPanels: (a: string, b: string) => void;
  stackPanel: (panelId: string, targetId: string, position: 'above' | 'below') => void;
  children: React.ReactNode;
}) {
  const [dropZone, setDropZone] = useState<'top' | 'bottom' | 'center' | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (!editMode || !draggedPanel || draggedPanel === panelId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPanel(panelId);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (y < 0.3) setDropZone('top');
    else if (y > 0.7) setDropZone('bottom');
    else setDropZone('center');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedPanel || draggedPanel === panelId) return;
    if (dropZone === 'top') stackPanel(draggedPanel, panelId, 'above');
    else if (dropZone === 'bottom') stackPanel(draggedPanel, panelId, 'below');
    else swapPanels(draggedPanel, panelId);
    setDraggedPanel(null);
    setDragOverPanel(null);
    setDropZone(null);
  };

  return (
    <div
      className={`h-full flex flex-col relative transition-all duration-200 ${editMode && dragOverPanel === panelId && draggedPanel !== panelId ? 'ring-2 ring-blue-500/60 ring-inset bg-blue-500/[0.04] scale-[0.98]' : ''}`}
      onDragOver={editMode ? handleDragOver : undefined}
      onDragLeave={editMode ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverPanel(null); setDropZone(null); } } : undefined}
      onDrop={editMode ? handleDrop : undefined}
    >
      {editMode && draggedPanel && draggedPanel !== panelId && dropZone === 'top' && (
        <div className="absolute inset-x-0 top-0 h-1/4 z-50 flex items-center justify-center pointer-events-none bg-blue-500/10 border-b-2 border-blue-500/50 rounded-t">
          <span className="text-[10px] font-medium text-blue-400">Stack above</span>
        </div>
      )}
      {editMode && draggedPanel && draggedPanel !== panelId && dropZone === 'bottom' && (
        <div className="absolute inset-x-0 bottom-0 h-1/4 z-50 flex items-center justify-center pointer-events-none bg-blue-500/10 border-t-2 border-blue-500/50 rounded-b">
          <span className="text-[10px] font-medium text-blue-400">Stack below</span>
        </div>
      )}
      {editMode && draggedPanel && draggedPanel !== panelId && dropZone === 'center' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
            <span className="text-[11px] font-medium text-blue-400">Drop to swap</span>
          </div>
        </div>
      )}
      {editMode && <DragHandle panelId={panelId} draggedPanel={draggedPanel} setDraggedPanel={setDraggedPanel} setDragOverPanel={setDragOverPanel} />}
      <div className={`flex-1 overflow-hidden transition-opacity duration-200 ${editMode && draggedPanel === panelId ? 'opacity-40' : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Stacked column: two panels vertically with a draggable splitter ───
function StackedColumn({ topId, bottomId, splitHeights, onSplitChange, editMode, draggedPanel, dragOverPanel, setDraggedPanel, setDragOverPanel, swapPanels, topContent, bottomContent }: {
  topId: string;
  bottomId: string;
  splitHeights: Record<string, number>;
  onSplitChange: (key: string, val: number) => void;
  editMode: boolean;
  draggedPanel: string | null;
  dragOverPanel: string | null;
  setDraggedPanel: (v: string | null) => void;
  setDragOverPanel: (v: string | null) => void;
  swapPanels: (a: string, b: string) => void;
  topContent: React.ReactNode;
  bottomContent: React.ReactNode;
}) {
  const splitKey = `${topId}-${bottomId}`;
  const topHeight = splitHeights[splitKey] ?? 50;
  const [dragging, setDragging] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!colRef.current) return;
      const rect = colRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      onSplitChange(splitKey, Math.max(10, Math.min(90, pct)));
    };
    const handleMouseUp = () => setDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
  }, [dragging, splitKey, onSplitChange]);

  const renderSubPanel = (panelId: string, heightStyle: React.CSSProperties, content: React.ReactNode) => (
    <div style={heightStyle} className="flex-shrink-0 overflow-hidden flex flex-col relative">
      {editMode && (
        <DragHandle panelId={panelId} draggedPanel={draggedPanel} setDraggedPanel={setDraggedPanel} setDragOverPanel={setDragOverPanel} />
      )}
      <div
        className={`flex-1 overflow-hidden transition-opacity duration-200 ${editMode && draggedPanel === panelId ? 'opacity-40' : ''}`}
        onDragOver={editMode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (draggedPanel && draggedPanel !== panelId) setDragOverPanel(panelId); } : undefined}
        onDragLeave={editMode ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverPanel(null); } : undefined}
        onDrop={editMode ? (e) => { e.preventDefault(); if (draggedPanel && draggedPanel !== panelId) swapPanels(draggedPanel, panelId); setDraggedPanel(null); setDragOverPanel(null); } : undefined}
      >
        {editMode && dragOverPanel === panelId && draggedPanel !== panelId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 backdrop-blur-sm">
              <span className="text-[11px] font-medium text-blue-400">Drop to swap</span>
            </div>
          </div>
        )}
        {content}
      </div>
    </div>
  );

  return (
    <div ref={colRef} className="h-full flex flex-col overflow-hidden select-none">
      {renderSubPanel(topId, { height: `${topHeight}%` }, topContent)}
      <div
        className={`splitter-h flex-shrink-0 cursor-row-resize ${dragging ? 'splitter-active' : ''}`}
        onMouseDown={() => setDragging(true)}
      />
      {renderSubPanel(bottomId, { height: `${100 - topHeight}%` }, bottomContent)}
    </div>
  );
}

// ─── Overlay with drop zones between and at edges of columns ───
type PanelSlotType = string | [string, string];
function ColumnInsertOverlay({ visibleLayout, draggedPanel, onInsert, setDraggedPanel, setDragOverPanel }: {
  visibleLayout: PanelSlotType[];
  draggedPanel: string;
  onInsert: (panelId: string, index: number) => void;
  setDraggedPanel: (v: string | null) => void;
  setDragOverPanel: (v: string | null) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const numCols = visibleLayout.length;

  // Render thin drop zones at each boundary: left edge, between columns, right edge
  return (
    <>
      {Array.from({ length: numCols + 1 }, (_, i) => {
        // Skip if dragged panel is adjacent (no-op)
        const leftSlot = i > 0 ? visibleLayout[i - 1] : null;
        const rightSlot = i < numCols ? visibleLayout[i] : null;
        const draggedIsLeft = leftSlot !== null && (leftSlot === draggedPanel || (Array.isArray(leftSlot) && leftSlot.includes(draggedPanel)));
        const draggedIsRight = rightSlot !== null && (rightSlot === draggedPanel || (Array.isArray(rightSlot) && rightSlot.includes(draggedPanel)));
        if (draggedIsLeft || draggedIsRight) return null;

        const isHovering = hoverIndex === i;
        // Position: left edge = 0%, between cols = i/numCols * 100%, right edge = 100%
        const leftPct = numCols > 0 ? (i / numCols) * 100 : 0;
        // Don't render insert zones at the very edges (index 0 and last) — they overlap panels too much
        if (i === 0 || i === numCols) return null;

        return (
          <div
            key={i}
            className={`absolute top-0 bottom-0 z-40 transition-all duration-150 flex items-center justify-center ${
              isHovering ? 'bg-blue-500/15' : ''
            }`}
            style={{
              left: `calc(${leftPct}% - 12px)`,
              width: '24px',
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setHoverIndex(i); }}
            onDragLeave={() => setHoverIndex(null)}
            onDrop={(e) => {
              e.preventDefault();
              onInsert(draggedPanel, i);
              setDraggedPanel(null);
              setDragOverPanel(null);
              setHoverIndex(null);
            }}
          >
            <div className={`w-0.5 rounded-full transition-all duration-150 ${
              isHovering ? 'h-3/4 bg-blue-400/70' : 'h-1/3 bg-blue-500/20'
            }`} />
          </div>
        );
      })}
    </>
  );
}

export default function ResizablePanels() {
  // Store button configurations with individual positions and sizes (locked in place)
  const [buttons] = useState<ButtonConfig[]>([
    { id: 1, x: 15, y: 15, width: 90, height: 45, label: "Home" },
    { id: 13, x: 115, y: 15, width: 70, height: 45, label: "Test" }, // Test Mode toggle
    { id: 10, x: 195, y: 15, width: 80, height: 45, label: "Saved" },
    { id: 2, x: 285, y: 15, width: 80, height: 45, label: "Filters" },
    { id: 3, x: 475, y: 15, width: 60, height: 45, label: "Settings" },
    { id: 5, x: 545, y: 15, width: 260, height: 45, label: "Site Chat" },
    { id: 6, x: 815, y: 15, width: 100, height: 45, label: "People" },
    { id: 7, x: 925, y: 15, width: 120, height: 45, label: "VAMP" },
    { id: 12, x: 1055, y: 15, width: 110, height: 45, label: "Deploy" },
    { id: 9, x: 1175, y: 15, width: 100, height: 45, label: "Button 9" },
  ]);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // UI preference — 'nnn' (default) or 'launchblitz'
  const [uiPreference, setUiPreference] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-ui-preference') || 'nnn';
    return 'nnn';
  });
  // Re-read on settings change (user may toggle in settings modal)
  useEffect(() => {
    const check = () => {
      const val = storeGet('nnn-ui-preference') || 'nnn';
      setUiPreference(prev => prev !== val ? val : prev);
    };
    window.addEventListener('storage', check);
    const interval = setInterval(check, 1000); // poll for same-tab localStorage changes
    return () => { window.removeEventListener('storage', check); clearInterval(interval); };
  }, []);

  // Panel visibility — persisted to localStorage
  const [panelVisibility, setPanelVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = storeGet('nnn-panel-visibility');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true };
  });
  useEffect(() => {
    storeSet('nnn-panel-visibility', JSON.stringify(panelVisibility));
  }, [panelVisibility]);
  const togglePanel = (id: string) => setPanelVisibility(prev => ({ ...prev, [id]: !prev[id] }));

  // Panel layout — nested structure: Array<string | [string, string]>
  // Each element is a column: either a single panel or a vertically stacked pair
  type PanelSlot = string | [string, string];
  type PanelLayout = PanelSlot[];
  const ALL_PANELS = ['deploy', 'canvas', 'search', 'images', 'ai', 'feed'];
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Try new format first
        const saved = storeGet('nnn-panel-layout');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
        // Migrate from old flat format
        const oldOrder = storeGet('nnn-panel-order');
        if (oldOrder) {
          const parsed = JSON.parse(oldOrder);
          if (Array.isArray(parsed)) {
            // Stack search+images together like original Panel2
            const result: PanelLayout = [];
            let addedStack = false;
            for (const id of parsed) {
              if (id === 'search' && !addedStack) {
                result.push(['search', 'images']);
                addedStack = true;
              } else if (id === 'images' && addedStack) {
                continue; // already in stack
              } else {
                result.push(id);
              }
            }
            return result;
          }
        }
      } catch {}
    }
    return [['deploy', 'canvas'], ['search', 'images'], 'ai', 'feed'];
  });
  useEffect(() => {
    storeSet('nnn-panel-layout', JSON.stringify(panelLayout));
  }, [panelLayout]);

  // Derive flat panelOrder for backward compat (SettingsModal, etc.)
  const panelOrder = useMemo(() =>
    panelLayout.flatMap(item => Array.isArray(item) ? item : [item]),
    [panelLayout]
  );

  // Edit mode + drag-and-drop state for panel reordering
  const [editMode, setEditMode] = useState(false);
  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<string | null>(null);

  // Find a panel's position in the layout: [slotIndex, subIndex | null]
  const findInLayout = (layout: PanelLayout, id: string): [number, number | null] | null => {
    for (let i = 0; i < layout.length; i++) {
      const slot = layout[i];
      if (Array.isArray(slot)) {
        if (slot[0] === id) return [i, 0];
        if (slot[1] === id) return [i, 1];
      } else if (slot === id) {
        return [i, null];
      }
    }
    return null;
  };

  const swapPanels = useCallback((fromId: string, toId: string) => {
    setPanelLayout(prev => {
      const next: PanelLayout = JSON.parse(JSON.stringify(prev));
      const fromPos = findInLayout(next, fromId);
      const toPos = findInLayout(next, toId);
      if (!fromPos || !toPos) return prev;

      const getVal = (pos: [number, number | null]) => {
        const slot = next[pos[0]];
        if (pos[1] !== null && Array.isArray(slot)) return slot[pos[1]];
        return slot as string;
      };
      const setVal = (pos: [number, number | null], val: string) => {
        if (pos[1] !== null && Array.isArray(next[pos[0]])) {
          (next[pos[0]] as [string, string])[pos[1]] = val;
        } else {
          next[pos[0]] = val;
        }
      };

      const fromVal = getVal(fromPos);
      const toVal = getVal(toPos);
      setVal(fromPos, toVal);
      setVal(toPos, fromVal);
      return next;
    });
  }, []);

  // Remove a panel from the layout, returning the cleaned layout
  const removeFromLayout = (layout: PanelLayout, panelId: string): PanelLayout => {
    const pos = findInLayout(layout, panelId);
    if (!pos) return layout;
    if (pos[1] !== null && Array.isArray(layout[pos[0]])) {
      // Was in a stack — extract the other panel as standalone
      const stack = layout[pos[0]] as [string, string];
      layout[pos[0]] = stack[1 - pos[1]];
    } else {
      layout.splice(pos[0], 1);
    }
    return layout;
  };

  // Stack a panel above or below a target panel
  const stackPanel = useCallback((panelId: string, targetId: string, position: 'above' | 'below') => {
    setPanelLayout(prev => {
      const next: PanelLayout = JSON.parse(JSON.stringify(prev));

      const targetPos = findInLayout(next, targetId);
      if (!targetPos) return prev;

      // If target is already in a stack, we can still stack — we just swap within
      // the stack or replace. For simplicity: if target is in a stack, swap instead.
      if (targetPos[1] !== null) {
        // Target is inside a stack — just do a swap
        const fromPos = findInLayout(next, panelId);
        if (!fromPos) return prev;
        const getVal = (pos: [number, number | null]) => {
          const slot = next[pos[0]];
          if (pos[1] !== null && Array.isArray(slot)) return slot[pos[1]];
          return slot as string;
        };
        const setVal = (pos: [number, number | null], val: string) => {
          if (pos[1] !== null && Array.isArray(next[pos[0]])) {
            (next[pos[0]] as [string, string])[pos[1]] = val;
          } else {
            next[pos[0]] = val;
          }
        };
        const fromVal = getVal(fromPos);
        const toVal = getVal(targetPos);
        setVal(fromPos, toVal);
        setVal(targetPos, fromVal);
        return next;
      }

      // Target is a standalone panel — remove panelId and create a stack
      removeFromLayout(next, panelId);

      // Re-find target after removal (indices may have shifted)
      const newTargetPos = findInLayout(next, targetId);
      if (!newTargetPos) return prev;

      // Create the stack
      next[newTargetPos[0]] = position === 'above'
        ? [panelId, targetId]
        : [targetId, panelId];

      return next;
    });
  }, []);

  // Insert a panel as a new column at a specific index (for dropping between columns)
  const insertPanelAt = useCallback((panelId: string, insertIndex: number) => {
    setPanelLayout(prev => {
      const next: PanelLayout = JSON.parse(JSON.stringify(prev));

      // Remove from current position
      removeFromLayout(next, panelId);

      // Clamp insert index
      const idx = Math.min(insertIndex, next.length);

      // Insert as standalone column
      next.splice(idx, 0, panelId);

      return next;
    });
  }, []);

  // Preset layouts (using nested format)
  const LAYOUT_PRESETS = useMemo(() => [
    { id: 'default', name: 'Default', layout: [['deploy', 'canvas'], ['search', 'images'], 'ai', 'feed'] as PanelLayout, visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } },
    { id: 'feed-first', name: 'Feed First', layout: ['feed', ['deploy', 'canvas'], ['search', 'images'], 'ai'] as PanelLayout, visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } },
    { id: 'minimal', name: 'Minimal', layout: ['deploy', 'feed', 'canvas', 'search', 'images', 'ai'] as PanelLayout, visibility: { deploy: true, canvas: false, search: false, images: false, ai: false, feed: true } },
    { id: 'research', name: 'Research', layout: [['search', 'images'], 'feed', 'ai', ['deploy', 'canvas']] as PanelLayout, visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } },
    { id: 'deploy-focus', name: 'Deploy Focus', layout: ['feed', ['ai', 'deploy'], 'canvas', 'search', 'images'] as PanelLayout, visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } },
    { id: 'separated', name: 'All Separate', layout: ['deploy', 'canvas', 'search', 'images', 'ai', 'feed'] as PanelLayout, visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } },
  ], []);

  const applyPreset = useCallback((preset: { layout?: PanelLayout; order?: string[]; visibility: Record<string, boolean> }) => {
    if (preset.layout) {
      setPanelLayout(preset.layout);
    } else if (preset.order) {
      // Backward compat: convert flat order to layout
      setPanelLayout(preset.order);
    }
    setPanelVisibility(preset.visibility);
  }, []);

  const resetLayout = () => {
    applyPreset(LAYOUT_PRESETS[0]);
  };

  // Visible layout — filter hidden panels, collapse empty stacks
  const visibleLayout = useMemo((): PanelLayout => {
    const result: PanelLayout = [];
    for (const slot of panelLayout) {
      if (Array.isArray(slot)) {
        const visible = slot.filter(id => panelVisibility[id] !== false);
        if (visible.length === 2) result.push(visible as [string, string]);
        else if (visible.length === 1) result.push(visible[0]);
      } else {
        if (panelVisibility[slot] !== false) result.push(slot);
      }
    }
    return result;
  }, [panelLayout, panelVisibility]);

  // Split heights for stacked columns, keyed by "topId-bottomId"
  const [splitHeights, setSplitHeights] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = storeGet('nnn-split-heights');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { 'deploy-canvas': 70 };
  });
  useEffect(() => {
    storeSet('nnn-split-heights', JSON.stringify(splitHeights));
  }, [splitHeights]);

  // Panel min/max size config
  const panelSizeConfig: Record<string, { minSize?: string; maxSize?: string }> = {
    deploy: { minSize: '10%', maxSize: '60%' },
    canvas: { minSize: '8%' },
    search: { minSize: '8%' },
    images: { minSize: '8%' },
    ai: { minSize: '4%' },
    feed: { minSize: '15%' },
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeploySettingsOpen, setIsDeploySettingsOpen] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [isVampOpen, setIsVampOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-theme') || 'modern-dark';
    return 'modern-dark';
  });
  const [wallets, setWallets] = useState<Wallet[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = storeGet(`nnn-wallets-${getRegionKey()}`);
      if (saved) {
        const parsed: Wallet[] = JSON.parse(saved);
        // privateKey is not stored in this list — will be retrieved from obfuscated local_wallets on deploy
        return parsed.map(w => ({ ...w, privateKey: w.privateKey || "" }));
      }
    } catch {}
    return [];
  });
  const [activeWallet, setActiveWallet] = useState<Wallet | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = storeGet(`nnn-wallets-${getRegionKey()}`);
      if (saved) {
        const parsed: Wallet[] = JSON.parse(saved);
        return parsed.find(w => w.isActive) || parsed[0] || null;
      }
    } catch {}
    return null;
  });
  // Persist wallets to localStorage (save metadata only, not raw private keys)
  useEffect(() => {
    const key = `nnn-wallets-${getRegionKey()}`;
    if (wallets.length > 0) {
      const toSave = wallets.map(w => ({ ...w, privateKey: "" }));
      storeSet(key, JSON.stringify(toSave));
    } else {
      storeRemove(key);
    }
  }, [wallets]);

  // Persist theme
  useEffect(() => { storeSet('nnn-theme', currentTheme); }, [currentTheme]);

  const MAX_TWEETS = 200;
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [feedPaused, setFeedPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  const feedPausedRef = useRef(false);
  const tweetBufferRef = useRef<Tweet[]>([]);
  const [pauseOnHover, setPauseOnHover] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = storeGet('nnn-pause-on-hover');
      return v !== null ? v === 'true' : true;
    }
    return true;
  });
  const [customNotifications, setCustomNotifications] = useState<CustomNotification[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = storeGet('nnn-custom-notifications');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [defaultColor, setDefaultColor] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-default-color') || '#00FFFF';
    return '#00FFFF';
  });
  const [highlightingEnabled, setHighlightingEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-highlighting-enabled') === 'true';
    return false;
  });
  const [highlightSoundsEnabled, setHighlightSoundsEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-highlight-sounds') === 'true';
    return false;
  });
  const [keywords, setKeywords] = useState<Keyword[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = storeGet('nnn-keywords');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Persist notifications, color, highlighting
  useEffect(() => { storeSet('nnn-custom-notifications', JSON.stringify(customNotifications)); }, [customNotifications]);
  useEffect(() => { storeSet('nnn-default-color', defaultColor); }, [defaultColor]);
  useEffect(() => { storeSet('nnn-highlighting-enabled', String(highlightingEnabled)); }, [highlightingEnabled]);
  useEffect(() => { storeSet('nnn-highlight-sounds', String(highlightSoundsEnabled)); }, [highlightSoundsEnabled]);
  useEffect(() => { storeSet('nnn-keywords', JSON.stringify(keywords)); }, [keywords]);

  const [chatInput, setChatInput] = useState("");

  // Online presence tracking via SSE
  const [onlineCount, setOnlineCount] = useState(0);
  useEffect(() => {
    const es = new EventSource('/api/presence');
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setOnlineCount(data.online);
      } catch {}
    };
    return () => es.close();
  }, []);

  // Live crypto prices
  const [showPrices, setShowPrices] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-show-prices') !== 'false';
    return true;
  });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const prevPrices = useRef<Record<string, number>>({});
  useEffect(() => { storeSet('nnn-show-prices', String(showPrices)); }, [showPrices]);
  useEffect(() => {
    if (!showPrices) return;
    let active = true;
    const fetchPrices = async () => {
      try {
        const res = await fetch('/api/prices');
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setPrices(prev => {
            prevPrices.current = prev;
            return data;
          });
        }
      } catch {}
    };
    fetchPrices();
    const interval = setInterval(fetchPrices, 5000);
    return () => { active = false; clearInterval(interval); };
  }, [showPrices]);

  // Custom Presets state
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [presetTrigger, setPresetTrigger] = useState<PresetTriggerData | null>(null);
  const [deployedImageUrl, setDeployedImageUrl] = useState<string | null>(null);
  const [deployedImageOptions, setDeployedImageOptions] = useState<string[]>([]);
  const [forceSelectImage, setForceSelectImage] = useState(false);
  const [deployedTwitterUrl, setDeployedTwitterUrl] = useState<string | null>(null);
  const [clearTrigger, setClearTrigger] = useState<number>(0); // Trigger to clear Panel1
  const [deployFlash, setDeployFlash] = useState(false);
  const [testMode, setTestMode] = useState(false); // Test mode for preview without deploying

  // Panel2 <-> Panel1 sync state
  const [panel1NameValue, setPanel1NameValue] = useState("");
  const [panel2SelectedImagePath, setPanel2SelectedImagePath] = useState<string | null>(null);
  const [tokenSearchQuery, setTokenSearchQuery] = useState<string | undefined>(undefined);
  const [vampData, setVampData] = useState<VampData | null>(null);
  const [latestTweet, setLatestTweet] = useState<Tweet | null>(null);

  // AI highlight results keyed by tweet id
  const [aiResults, setAiResults] = useState<Record<string, { name: string; ticker: string; images: string[]; suggestions?: Array<{ name: string; ticker: string }> }>>({});
  const aiLastProcessedRef = useRef<string>("");
  const aiQueuedIdsRef = useRef<Set<string>>(new Set());

  // Browser images from Panel2's ImageBrowser (for AI popup matching)
  const [browserImages, setBrowserImages] = useState<Array<{ name: string; nameWithoutExt: string; filename: string }>>([]);
  const handleBrowserImagesLoaded = useCallback((imgs: Array<{ name: string; nameWithoutExt: string; filename: string }>) => {
    setBrowserImages(imgs.map(i => ({ name: i.name, nameWithoutExt: i.nameWithoutExt, filename: i.filename })));
  }, []);

  // Direct-load browser images on mount (ensures browserImages is populated for AI popup)
  useEffect(() => {
    fetch('/api/local-images')
      .then(r => r.json())
      .then(data => {
        if (data.images && Array.isArray(data.images)) {
          setBrowserImages(data.images.map((i: any) => ({ name: i.name, nameWithoutExt: i.nameWithoutExt, filename: i.filename })));
        }
      })
      .catch(() => {});
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Use ref to avoid stale closures in callbacks
  const customNotificationsRef = useRef(customNotifications);
  useEffect(() => {
    customNotificationsRef.current = customNotifications;
  }, [customNotifications]);

  const theme = getTheme(currentTheme);

  // Listen for NNN Chrome Extension events (deploy/image from Axiom)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.data) return;
      const { type, data } = detail;
      if (type === "DEPLOY_TOKEN") {
        // Extension click — fill everything + auto-select platform
        setVampData({
          tokenName: data.tokenName || "",
          tokenSymbol: data.tokenSymbol || "",
          tokenImage: data.tokenImage || "",
          website: "",
          twitter: data.twitter || "",
          platform: data.platform || undefined,
        });
      } else if (type === "SEND_TO_TRACKER") {
        // Image click — only set the image, keep existing name/ticker
        if (data.tokenImage) {
          setDeployedImageUrl(data.tokenImage);
          setDeployedImageOptions([data.tokenImage]);
        }
      }
    };
    window.addEventListener("nnn-extension-data", handler);
    return () => window.removeEventListener("nnn-extension-data", handler);
  }, []);

  // Play notification sound - memoized
  const playNotificationSound = useCallback((soundName: string) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    
    switch(soundName) {
      case "Beep": oscillator.frequency.setValueAtTime(800, audioContext.currentTime); oscillator.type = "sine"; break;
      case "Ding": oscillator.frequency.setValueAtTime(1200, audioContext.currentTime); oscillator.type = "sine"; break;
      case "Chime": oscillator.frequency.setValueAtTime(1000, audioContext.currentTime); oscillator.type = "triangle"; break;
      case "Coin": oscillator.frequency.setValueAtTime(1500, audioContext.currentTime); oscillator.type = "square"; break;
      case "Buzz": oscillator.frequency.setValueAtTime(200, audioContext.currentTime); oscillator.type = "sawtooth"; break;
      case "Harsh Buzz": oscillator.frequency.setValueAtTime(150, audioContext.currentTime); oscillator.type = "sawtooth"; break;
      case "Electric Shock": oscillator.frequency.setValueAtTime(100, audioContext.currentTime); oscillator.type = "square"; break;
      case "Metal Clang": oscillator.frequency.setValueAtTime(2000, audioContext.currentTime); oscillator.type = "square"; break;
      case "Chainsaw": oscillator.frequency.setValueAtTime(80, audioContext.currentTime); oscillator.type = "sawtooth"; break;
      case "Destroyer": oscillator.frequency.setValueAtTime(50, audioContext.currentTime); oscillator.type = "sawtooth"; break;
      default: oscillator.frequency.setValueAtTime(600, audioContext.currentTime); oscillator.type = "sine";
    }
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  }, []);

  // Memoized callbacks for J7Feed to prevent reconnections
  const handleTweetReceived = useCallback((j7Tweet: any) => {
    // Extract author info (who posted/retweeted)
    const authorData = j7Tweet.author || {};
    
    // For retweets/quotes, we show the POSTER's info in header, but ORIGINAL content
    const rawUsername = authorData?.handle ||
                     authorData?.name ||
                     authorData?.username ||
                     authorData?.screenName ||
                     j7Tweet.username ||
                     j7Tweet.handle ||
                     j7Tweet.screenName ||
                     'unknown';
    const username = rawUsername.replace(/^@/, '');
    
    const displayName = authorData?.name || 
                       authorData?.displayName ||
                       authorData?.handle || 
                       username;
    
    const profilePic = authorData?.avatar ||
                      authorData?.profilePic ||
                      j7Tweet.profilePic ||
                      j7Tweet.icon ||
                      '';
    
    const verified = authorData?.verified || false;

    
    const customNotif = customNotificationsRef.current.find(n => 
      n.username.toLowerCase() === `@${username.toLowerCase()}`
    );
    
    // Extract ALL media (images, videos, gifs) - check all possible locations
    const mediaSource = j7Tweet.isRetweet ? j7Tweet.originalMedia : j7Tweet.media;
    const media: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];

    // Handle Bark flat format: media is [{type, url}]
    if (Array.isArray(mediaSource)) {
      mediaSource.forEach((item: any) => {
        if (item && item.url) {
          media.push({ type: item.type || 'image', url: item.url });
        }
      });
    }
    // Handle J7 nested format: media is {images: [], videos: []}
    else if (mediaSource) {
      if (mediaSource.images && Array.isArray(mediaSource.images)) {
        mediaSource.images.forEach((img: any) => {
          if (img && img.url) {
            media.push({ type: 'image', url: img.url });
          }
        });
      }
      if (mediaSource.videos && Array.isArray(mediaSource.videos)) {
        mediaSource.videos.forEach((vid: any) => {
          if (vid && (vid.url || vid.thumbnail)) {
            media.push({ type: 'video', url: vid.url || vid.thumbnail, ...(vid.thumbnail ? { thumbnail: vid.thumbnail } : {}) });
          }
        });
      }
    }

    // Fallback: Check if media is directly on j7Tweet
    if (media.length === 0 && j7Tweet.images && Array.isArray(j7Tweet.images)) {
      j7Tweet.images.forEach((img: any) => {
        if (img) {
          media.push({ type: 'image', url: typeof img === 'string' ? img : img.url });
        }
      });
    }
    
    const imageUrl = media.find(m => m.type === 'image')?.url;
    const timestamp = j7Tweet.createdAt ? new Date(j7Tweet.createdAt).toISOString() : new Date().toISOString();
    
    // Extract reply information
    const replyTo = j7Tweet.replyTo || j7Tweet.repliedTo || null;

    // Extract quoted tweet (for quote tweets/retweets)
    // Bark pre-builds quotedTweet with correct data - pass it through directly
    let quotedTweet: Tweet | undefined;
    if (j7Tweet.quotedTweet) {
      const qt = j7Tweet.quotedTweet;
      const qtMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
      // Handle Bark flat format: [{type, url}]
      if (Array.isArray(qt.media)) {
        qt.media.forEach((item: any) => {
          if (item && item.url) qtMedia.push({ type: item.type || 'image', url: item.url });
        });
      }
      // Handle J7 nested format: {images: [], videos: []}
      else if (qt.media) {
        if (qt.media.images) {
          qt.media.images.forEach((img: any) => {
            if (img && img.url) qtMedia.push({ type: 'image', url: img.url });
          });
        }
        if (qt.media.videos) {
          qt.media.videos.forEach((vid: any) => {
            if (vid && (vid.url || vid.thumbnail)) qtMedia.push({ type: 'video', url: vid.url || vid.thumbnail, ...(vid.thumbnail ? { thumbnail: vid.thumbnail } : {}) });
          });
        }
      }

      quotedTweet = {
        id: qt.id || 'quoted',
        username: (qt.username || qt.author?.handle || 'unknown').replace(/^@/, ''),
        displayName: qt.displayName || qt.author?.name || qt.author?.handle || 'Unknown',
        handle: qt.handle?.startsWith('@') ? qt.handle : `@${(qt.username || qt.author?.handle || 'unknown').replace(/^@/, '')}`,
        verified: qt.verified || qt.author?.verified || false,
        timestamp: qt.createdAt ? new Date(qt.createdAt).toISOString() : (qt.timestamp || timestamp),
        text: qt.text || '',
        profilePic: qt.profilePic || qt.author?.avatar || '',
        highlightColor: undefined,
        media: qtMedia.length > 0 ? qtMedia : undefined,
      };
    }

    // Extract replied-to tweet (for replies)
    // PRIORITY 1: Bark pre-builds repliedToTweet - pass through directly
    let repliedToTweet: Tweet | undefined;
    if (j7Tweet.repliedToTweet) {
      const rt = j7Tweet.repliedToTweet;
      // Bark already built this with correct format - just normalize media
      const rtMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
      if (Array.isArray(rt.media)) {
        rt.media.forEach((item: any) => {
          if (item && item.url) rtMedia.push({ type: item.type || 'image', url: item.url });
        });
      }
      repliedToTweet = {
        id: rt.id || 'replied',
        username: (rt.username || 'unknown').replace(/^@/, ''),
        displayName: rt.displayName || rt.username || 'Unknown',
        handle: rt.handle?.startsWith('@') ? rt.handle : `@${(rt.username || 'unknown').replace(/^@/, '')}`,
        verified: rt.verified || false,
        timestamp: rt.timestamp || timestamp,
        text: rt.text || '',
        profilePic: rt.profilePic || '',
        highlightColor: undefined,
        media: rtMedia.length > 0 ? rtMedia : undefined,
      };
    }
    // PRIORITY 2: J7 format - replyTo/repliedTo object
    else if (replyTo) {
      const rt = replyTo;

      const rtMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
      // Handle both flat and nested media formats
      if (Array.isArray(rt.media)) {
        rt.media.forEach((item: any) => {
          if (item && item.url) rtMedia.push({ type: item.type || 'image', url: item.url });
        });
      } else if (rt.media) {
        if (rt.media.images && Array.isArray(rt.media.images)) {
          rt.media.images.forEach((img: any) => {
            const url = img.url || img.src || img;
            if (url) rtMedia.push({ type: 'image', url: typeof url === 'string' ? url : url.url });
          });
        }
        if (rt.media.videos && Array.isArray(rt.media.videos)) {
          rt.media.videos.forEach((vid: any) => {
            const url = vid.url || vid.src || vid.thumbnail || vid;
            if (url) rtMedia.push({ type: 'video', url: typeof url === 'string' ? url : url.url, ...(vid.thumbnail ? { thumbnail: vid.thumbnail } : {}) });
          });
        }
      }
      if (rtMedia.length === 0 && rt.images && Array.isArray(rt.images)) {
        rt.images.forEach((img: any) => {
          const url = img.url || img;
          if (url) rtMedia.push({ type: 'image', url: typeof url === 'string' ? url : url.url });
        });
      }

      const rtUsername = rt.author?.handle || rt.author?.username || rt.handle || rt.username || 'unknown';
      const rtDisplayName = rt.author?.name || rt.author?.displayName || rt.name || rt.displayName || rtUsername;
      const rtText = rt.text || rt.fullText || rt.full_text || rt.content || '';
      const rtProfilePic = rt.author?.avatar || rt.author?.profilePic || rt.avatar || rt.profilePic || '';

      repliedToTweet = {
        id: rt.id || rt.tweetId || 'replied',
        username: rtUsername,
        displayName: rtDisplayName,
        handle: `@${rtUsername}`,
        verified: rt.author?.verified || rt.verified || false,
        timestamp: rt.createdAt ? new Date(rt.createdAt).toISOString() : timestamp,
        text: rtText || 'No text available',
        profilePic: rtProfilePic,
        highlightColor: undefined,
        media: rtMedia.length > 0 ? rtMedia : undefined,
      };
    }

    // Extract link previews - check both J7 format (links) and Bark format (linkPreviews)
    const linkPreviews: Array<{url: string; title?: string; description?: string; image?: string; domain?: string}> = [];
    if (j7Tweet.links && Array.isArray(j7Tweet.links)) {
      j7Tweet.links.forEach((link: any) => {
        linkPreviews.push({
          url: link.url || link.expandedUrl || '',
          title: link.title,
          description: link.description,
          image: link.image || link.thumbnail,
          domain: link.domain || (() => { try { return new URL(link.url || link.expandedUrl || 'https://example.com').hostname; } catch { return ''; } })(),
        });
      });
    }
    // Pass through Bark-processed linkPreviews
    if (linkPreviews.length === 0 && j7Tweet.linkPreviews && Array.isArray(j7Tweet.linkPreviews)) {
      j7Tweet.linkPreviews.forEach((lp: any) => {
        linkPreviews.push(lp);
      });
    }
    // Fallback: extract URLs from tweet text if no link previews were provided
    if (linkPreviews.length === 0 && j7Tweet.text) {
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
      const urls = j7Tweet.text.match(urlRegex) || [];
      urls.forEach((u: string) => {
        // Skip twitter/x.com links — those aren't article previews
        if (!u.includes('twitter.com') && !u.includes('x.com')) {
          linkPreviews.push({ url: u });
        }
      });
    }

    // For RETWEETS, create an embedded tweet for the original content
    // Only rebuild from J7-style fields if Bark didn't already provide quotedTweet
    let retweetedTweet: Tweet | undefined;
    let retweetOriginalAuthor: any;
    const isRetweet = j7Tweet.isRetweet || j7Tweet.type === 'RETWEET';
    if (isRetweet && !quotedTweet) {
      // J7 format: rebuild from originalAuthor/retweetedStatus
      retweetOriginalAuthor = j7Tweet.originalAuthor || j7Tweet.retweetedStatus?.author || {};
      const originalUsername = retweetOriginalAuthor?.handle || retweetOriginalAuthor?.username || 'unknown';
      const originalDisplayName = retweetOriginalAuthor?.name || originalUsername;

      retweetedTweet = {
        id: j7Tweet.originalTweetId || j7Tweet.retweetedStatus?.id || 'retweeted',
        username: originalUsername,
        displayName: originalDisplayName,
        handle: `@${originalUsername}`,
        verified: retweetOriginalAuthor?.verified || false,
        timestamp: j7Tweet.createdAt ? new Date(j7Tweet.createdAt).toISOString() : timestamp,
        text: j7Tweet.text || j7Tweet.retweetedStatus?.text || '',
        profilePic: retweetOriginalAuthor?.avatar || retweetOriginalAuthor?.profilePic || '',
        highlightColor: undefined,
        media: media.length > 0 ? media : undefined,
      };
    }

    // Determine the final embedded tweet: retweetedTweet (J7 retweet rebuild) or quotedTweet (Bark pre-built / J7 quote)
    const finalEmbeddedTweet = retweetedTweet || quotedTweet;

    // Determine originalAuthorHandle for retweet display
    const originalAuthorHandle = isRetweet
      ? (j7Tweet.originalAuthorHandle || // Bark pre-built
         (retweetOriginalAuthor?.handle ? `@${retweetOriginalAuthor.handle}` : undefined) || // J7 rebuild
         (quotedTweet ? `@${quotedTweet.username}` : undefined)) // Fallback from embedded tweet
      : undefined;

    const newTweet: Tweet = {
      id: `j7-${Date.now()}-${Math.random()}`,
      twitterStatusId: j7Tweet.id || j7Tweet.tweetId || j7Tweet.statusId,
      username,
      displayName,
      handle: `@${username}`,
      verified,
      timestamp,
      text: isRetweet ? '' : (j7Tweet.text || ''),
      imageUrl,
      profilePic,
      highlightColor: customNotif?.color,
      isRetweet: isRetweet || false,
      isReply: j7Tweet.isReply || !!repliedToTweet || false,
      isQuote: !isRetweet && (j7Tweet.isQuote || false),
      tweetType: j7Tweet.type || j7Tweet.tweetType,
      media: isRetweet ? undefined : (media.length > 0 ? media : undefined),
      originalAuthorHandle,
      quotedTweet: finalEmbeddedTweet,
      repliedToTweet,
      linkPreviews: linkPreviews.length > 0 ? linkPreviews : undefined,
      followedUser: j7Tweet.followedUser,
    };

    // Render tweet FIRST — preloading happens after
    if (feedPausedRef.current) {
      tweetBufferRef.current = [newTweet, ...tweetBufferRef.current];
      setBufferedCount(tweetBufferRef.current.length);
    } else {
      setTweets(prev => [newTweet, ...prev]);
    }
    setLatestTweet(newTweet);

    if (customNotif && customNotif.sound !== "None (Highlight Only)") {
      playNotificationSound(customNotif.sound);
    }

    // Preload ALL images after tweet is rendered — non-blocking
    queueMicrotask(() => {
      const px = (u: string) => `/api/proxy-image?url=${encodeURIComponent(u)}`;
      const preload = (u: string) => { const img = new Image(); img.src = px(u); };

      // Collect every image URL in the tweet
      const urls: string[] = [];

      // Profile pics
      if (newTweet.profilePic) urls.push(newTweet.profilePic);
      if (newTweet.quotedTweet?.profilePic) urls.push(newTweet.quotedTweet.profilePic);
      if (newTweet.repliedToTweet?.profilePic) urls.push(newTweet.repliedToTweet.profilePic);
      if (newTweet.followedUser?.profilePic) urls.push(newTweet.followedUser.profilePic);

      // Standalone imageUrl
      if (newTweet.imageUrl) urls.push(newTweet.imageUrl);

      // Media (images, gifs, video thumbnails)
      for (const t of [newTweet, newTweet.quotedTweet, newTweet.repliedToTweet]) {
        if (!t?.media) continue;
        for (const m of t.media) {
          if (m.type !== 'video') urls.push(m.url);
          if ((m as any).thumbnail) urls.push((m as any).thumbnail);
        }
      }

      // Preload all unique image URLs
      const seen = new Set<string>();
      urls.filter(Boolean).forEach(u => { if (!seen.has(u)) { seen.add(u); preload(u); } });

      // Pre-fetch full link metadata so LinkPreviewCard has data immediately
      const linksToEnrich = (newTweet.linkPreviews || []).filter(lp => (!lp.title || !lp.image) && lp.url && !lp.url.includes('twitter.com') && !lp.url.includes('x.com'));
      if (linksToEnrich.length > 0) {
        Promise.all(linksToEnrich.slice(0, 3).map(async lp => {
          try {
            const res = await fetch(`/api/link-metadata?url=${encodeURIComponent(lp.url)}`);
            const data = await res.json();
            if (data.image) lp.image = data.image;
            if (data.title) lp.title = data.title;
            if (data.description) lp.description = data.description;
            if (data.domain) lp.domain = data.domain;
            if (lp.image) preload(lp.image);
          } catch {}
        })).then(() => {
          setTweets(prev => prev.map(t => t.id === newTweet.id ? { ...t, linkPreviews: [...(t.linkPreviews || [])] } : t));
        });
      }
    });
  }, [playNotificationSound]);

  const handleFeedHover = useCallback((hovered: boolean) => {
    if (!pauseOnHover) return;
    if (hovered) {
      feedPausedRef.current = true;
      setFeedPaused(true);
    } else {
      feedPausedRef.current = false;
      setFeedPaused(false);
      // Flush buffered tweets
      if (tweetBufferRef.current.length > 0) {
        const buffered = tweetBufferRef.current;
        tweetBufferRef.current = [];
        setBufferedCount(0);
        setTweets(prev => [...buffered, ...prev]);
      }
    }
  }, [pauseOnHover]);

  const handleInitialTweets = useCallback((initialTweets: any[]) => {
    const convertedTweets: Tweet[] = initialTweets.map((j7Tweet, index) => {
      // Same improved logic as handleTweetReceived
      const authorData = j7Tweet.author || {};
      const contentSource = j7Tweet.isRetweet && j7Tweet.originalAuthor ? j7Tweet.originalAuthor : j7Tweet.author;
      
      const username = (contentSource?.handle ||
                       contentSource?.name ||
                       authorData?.handle ||
                       authorData?.name ||
                       j7Tweet.handle ||
                       'unknown').replace(/^@/, '');
      
      const displayName = contentSource?.name || 
                         contentSource?.handle || 
                         authorData?.name ||
                         username;
      
      const profilePic = contentSource?.avatar ||
                        authorData?.avatar ||
                        j7Tweet.profilePic ||
                        j7Tweet.icon ||
                        '';
      
      const verified = contentSource?.verified || authorData?.verified || false;
      
      const customNotif = customNotificationsRef.current.find(n => 
        n.username.toLowerCase() === `@${username.toLowerCase()}`
      );
      
      // Extract ALL media with improved fallbacks
      const mediaSource = j7Tweet.isRetweet ? j7Tweet.originalMedia : j7Tweet.media;
      const media: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];

      // Handle Bark flat format: media is [{type, url}]
      if (Array.isArray(mediaSource)) {
        mediaSource.forEach((item: any) => {
          if (item && item.url) {
            media.push({ type: item.type || 'image', url: item.url });
          }
        });
      }
      // Handle J7 nested format: media is {images: [], videos: []}
      else if (mediaSource) {
        if (mediaSource.images && Array.isArray(mediaSource.images)) {
          mediaSource.images.forEach((img: any) => {
            if (img && img.url) {
              media.push({ type: 'image', url: img.url });
            }
          });
        }
        if (mediaSource.videos && Array.isArray(mediaSource.videos)) {
          mediaSource.videos.forEach((vid: any) => {
            if (vid && (vid.url || vid.thumbnail)) {
              media.push({ type: 'video', url: vid.url || vid.thumbnail, ...(vid.thumbnail ? { thumbnail: vid.thumbnail } : {}) });
            }
          });
        }
      }

      // Fallback for direct images
      if (media.length === 0 && j7Tweet.images && Array.isArray(j7Tweet.images)) {
        j7Tweet.images.forEach((img: any) => {
          if (img) {
            media.push({ type: 'image', url: typeof img === 'string' ? img : img.url });
          }
        });
      }
      
      const imageUrl = media.find(m => m.type === 'image')?.url;
      const timestamp = j7Tweet.createdAt ? new Date(j7Tweet.createdAt).toISOString() : new Date().toISOString();
      const isRetweet = j7Tweet.isRetweet || j7Tweet.type === 'RETWEET';

      // Build quotedTweet from Bark pre-built or J7 data
      let initQuotedTweet: Tweet | undefined;
      if (j7Tweet.quotedTweet) {
        const qt = j7Tweet.quotedTweet;
        const qtMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
        if (Array.isArray(qt.media)) {
          qt.media.forEach((item: any) => {
            if (item && item.url) qtMedia.push({ type: item.type || 'image', url: item.url });
          });
        }
        initQuotedTweet = {
          id: qt.id || 'quoted',
          username: qt.username || qt.author?.handle || 'unknown',
          displayName: qt.displayName || qt.author?.name || 'Unknown',
          handle: qt.handle || `@${qt.username || qt.author?.handle || 'unknown'}`,
          verified: qt.verified || qt.author?.verified || false,
          timestamp: qt.timestamp || timestamp,
          text: qt.text || '',
          profilePic: qt.profilePic || qt.author?.avatar || '',
          media: qtMedia.length > 0 ? qtMedia : undefined,
        };
      }

      // Build repliedToTweet from Bark pre-built or J7 data
      let initRepliedTo: Tweet | undefined;
      if (j7Tweet.repliedToTweet) {
        const rt = j7Tweet.repliedToTweet;
        const rtMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
        if (Array.isArray(rt.media)) {
          rt.media.forEach((item: any) => {
            if (item && item.url) rtMedia.push({ type: item.type || 'image', url: item.url });
          });
        }
        initRepliedTo = {
          id: rt.id || 'replied',
          username: rt.username || 'unknown',
          displayName: rt.displayName || rt.username || 'Unknown',
          handle: rt.handle || `@${rt.username || 'unknown'}`,
          verified: rt.verified || false,
          timestamp: rt.timestamp || timestamp,
          text: rt.text || '',
          profilePic: rt.profilePic || '',
          media: rtMedia.length > 0 ? rtMedia : undefined,
        };
      }

      // Extract link previews
      const initLinkPreviews: Array<{url: string; title?: string; description?: string; image?: string; domain?: string}> = [];
      if (j7Tweet.links && Array.isArray(j7Tweet.links)) {
        j7Tweet.links.forEach((link: any) => {
          initLinkPreviews.push({
            url: link.url || link.expandedUrl || '',
            title: link.title,
            description: link.description,
            image: link.image || link.thumbnail,
            domain: link.domain || (() => { try { return new URL(link.url || link.expandedUrl || 'https://example.com').hostname; } catch { return ''; } })(),
          });
        });
      }
      if (initLinkPreviews.length === 0 && j7Tweet.linkPreviews && Array.isArray(j7Tweet.linkPreviews)) {
        j7Tweet.linkPreviews.forEach((lp: any) => initLinkPreviews.push(lp));
      }
      // Fallback: extract URLs from tweet text
      if (initLinkPreviews.length === 0 && j7Tweet.text) {
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
        const urls = j7Tweet.text.match(urlRegex) || [];
        urls.forEach((u: string) => {
          if (!u.includes('twitter.com') && !u.includes('x.com')) {
            initLinkPreviews.push({ url: u });
          }
        });
      }

      // Determine originalAuthorHandle for retweets
      const origAuthor = isRetweet
        ? (j7Tweet.originalAuthorHandle || (j7Tweet.author?.handle ? `@${j7Tweet.author.handle}` : undefined) || (initQuotedTweet ? `@${initQuotedTweet.username}` : undefined))
        : undefined;

      return {
        id: `j7-init-${Date.now()}-${index}`,
        twitterStatusId: j7Tweet.id || j7Tweet.tweetId || j7Tweet.statusId,
        username,
        displayName,
        handle: `@${username}`,
        verified,
        timestamp,
        text: isRetweet ? '' : (j7Tweet.text || ''),
        imageUrl,
        profilePic,
        highlightColor: customNotif?.color,
        isRetweet: isRetweet || false,
        isReply: j7Tweet.isReply || !!initRepliedTo || false,
        isQuote: !isRetweet && (j7Tweet.isQuote || false),
        tweetType: j7Tweet.type || j7Tweet.tweetType,
        media: isRetweet ? undefined : (media.length > 0 ? media : undefined),
        originalAuthorHandle: origAuthor,
        quotedTweet: initQuotedTweet,
        repliedToTweet: initRepliedTo,
        linkPreviews: initLinkPreviews.length > 0 ? initLinkPreviews : undefined,
        followedUser: j7Tweet.followedUser,
      };
    });

    setTweets(prev => [...convertedTweets, ...prev]);

    // Preload after render — all images + link metadata
    queueMicrotask(() => {
      const pxUrl = (u: string) => `/api/proxy-image?url=${encodeURIComponent(u)}`;
      const preload = (u: string) => { const img = new Image(); img.src = pxUrl(u); };
      const seen = new Set<string>();
      const preloadOnce = (u: string) => { if (u && !seen.has(u)) { seen.add(u); preload(u); } };

      convertedTweets.forEach(tweet => {
        // All images: profile pics, media, thumbnails, imageUrl, embedded tweets, follow cards
        if (tweet.profilePic) preloadOnce(tweet.profilePic);
        if (tweet.imageUrl) preloadOnce(tweet.imageUrl);
        if (tweet.quotedTweet?.profilePic) preloadOnce(tweet.quotedTweet.profilePic);
        if (tweet.repliedToTweet?.profilePic) preloadOnce(tweet.repliedToTweet.profilePic);
        if (tweet.followedUser?.profilePic) preloadOnce(tweet.followedUser.profilePic);
        for (const t of [tweet, tweet.quotedTweet, tweet.repliedToTweet]) {
          if (!t?.media) continue;
          for (const m of t.media) {
            if (m.type !== 'video') preloadOnce(m.url);
            if ((m as any).thumbnail) preloadOnce((m as any).thumbnail);
          }
        }

        // Pre-fetch link metadata
        const linksToEnrich = (tweet.linkPreviews || []).filter(lp => (!lp.title || !lp.image) && lp.url && !lp.url.includes('twitter.com') && !lp.url.includes('x.com'));
        if (linksToEnrich.length > 0) {
          Promise.all(linksToEnrich.slice(0, 3).map(async lp => {
            try {
              const res = await fetch(`/api/link-metadata?url=${encodeURIComponent(lp.url)}`);
              const data = await res.json();
              if (data.image) lp.image = data.image;
              if (data.title) lp.title = data.title;
              if (data.description) lp.description = data.description;
              if (data.domain) lp.domain = data.domain;
              if (lp.image) preloadOnce(lp.image);
            } catch {}
          })).then(() => {
            setTweets(prev => prev.map(t => t.id === tweet.id ? { ...t, linkPreviews: [...(t.linkPreviews || [])] } : t));
          });
        }
      });
    });
  }, []);

  // Handle tweet deletion
  const handleTweetDeleted = useCallback((tweetId: string) => {
    setTweets(prev => prev.filter(tweet => !tweet.id.includes(tweetId)));
  }, []);

  // Handle follow events - Create notification tweet
  const handleFollow = useCallback((data: any) => {
    const follower = data.follower || data.user || {};
    const following = data.following || data.target || {};
    
    const username = (follower.handle || follower.username || 'someone').replace(/^@/, '');
    const targetUsername = (following.handle || following.username || 'someone').replace(/^@/, '');
    
    const eventTweet: Tweet = {
      id: `follow-${Date.now()}-${Math.random()}`,
      username: username,
      displayName: follower.name || username,
      handle: `@${username}`,
      verified: follower.verified || false,
      timestamp: new Date().toISOString(),
      text: `Started following @${targetUsername}`,
      profilePic: follower.avatar || '',
      highlightColor: '#10b981', // Green
      tweetType: 'FOLLOW',
    };
    
    setTweets(prev => [eventTweet, ...prev]);
  }, []);

  // Handle unfollow events - Create notification tweet
  const handleUnfollow = useCallback((data: any) => {
    const unfollower = data.unfollower || data.user || {};
    const unfollowing = data.unfollowing || data.target || {};
    
    const username = (unfollower.handle || unfollower.username || 'someone').replace(/^@/, '');
    const targetUsername = (unfollowing.handle || unfollowing.username || 'someone').replace(/^@/, '');
    
    const eventTweet: Tweet = {
      id: `unfollow-${Date.now()}-${Math.random()}`,
      username: username,
      displayName: unfollower.name || username,
      handle: `@${username}`,
      verified: unfollower.verified || false,
      timestamp: new Date().toISOString(),
      text: `Unfollowed @${targetUsername}`,
      profilePic: unfollower.avatar || '',
      highlightColor: '#ef4444', // Red
      tweetType: 'UNFOLLOW',
    };
    
    setTweets(prev => [eventTweet, ...prev]);
  }, []);

  // Handle deactivation events - Create notification tweet and remove their tweets
  const handleDeactivation = useCallback((data: any) => {
    const user = data.user || data;
    const username = (user.handle || user.username || 'someone').replace(/^@/, '');
    
    const eventTweet: Tweet = {
      id: `deactivation-${Date.now()}-${Math.random()}`,
      username: username,
      displayName: user.name || username,
      handle: `@${username}`,
      verified: user.verified || false,
      timestamp: new Date().toISOString(),
      text: 'Account has been deactivated',
      profilePic: user.avatar || '',
      highlightColor: '#6b7280', // Gray
      tweetType: 'DEACTIVATION',
    };
    
    // Add the deactivation notification
    setTweets(prev => [eventTweet, ...prev]);
    
    // Remove all tweets from this deactivated user
    if (username) {
      setTimeout(() => {
        setTweets(prev => prev.filter(tweet => 
          tweet.handle.toLowerCase() !== `@${username.toLowerCase()}` || 
          tweet.tweetType === 'DEACTIVATION'
        ));
      }, 100);
    }
  }, []);

  // Handle profile change events (bark.gg only)
  const handleProfileChange = useCallback((data: any) => {
    const { type, author, changes } = data;
    let notificationText = '';
    let highlightColor = '#3b82f6'; // Blue for profile changes
    
    switch (type) {
      case 'BIO_CHANGE':
        notificationText = `Bio changed:\nOld: ${changes.OLD_BIO || 'None'}\nNew: ${changes.NEW_BIO || 'None'}`;
        break;
      case 'NAME_CHANGE':
        notificationText = `Name changed: "${changes.OLD_NAME}" → "${changes.NEW_NAME}"`;
        break;
      case 'PROFILE_PICTURE_CHANGE':
        notificationText = `Profile picture updated`;
        break;
      case 'WEBSITE_CHANGE':
        notificationText = `Website changed:\n${changes.OLD_WEBSITE || 'None'} → ${changes.NEW_WEBSITE || 'None'}`;
        break;
      case 'LOCATION_CHANGE':
        notificationText = `Location changed:\n${changes.OLD_LOCATION || 'None'} → ${changes.NEW_LOCATION || 'None'}`;
        break;
      case 'PINNED_TWEET':
        notificationText = `📌 Pinned a tweet:\n${changes.TWEET_TEXT || 'No text'}`;
        break;
      case 'UNPINNED_TWEET':
        notificationText = `📌 Unpinned a tweet:\n${changes.TWEET_TEXT || 'No text'}`;
        break;
      case 'PINNED_CHANGE':
        notificationText = `📌 Changed pinned tweet:\nOld: ${changes.OLD_TWEET_TEXT || 'None'}\nNew: ${changes.NEW_TWEET_TEXT || 'None'}`;
        break;
      case 'BANNER_CHANGE':
        notificationText = `Banner image updated`;
        break;
      default:
        notificationText = `Profile updated: ${type}`;
    }
    
    const eventTweet: Tweet = {
      id: `profile-${type}-${Date.now()}-${Math.random()}`,
      username: author.handle || 'unknown',
      displayName: author.name || author.handle || 'Unknown',
      handle: `@${author.handle || 'unknown'}`,
      verified: false,
      timestamp: new Date().toISOString(),
      text: notificationText,
      profilePic: author.icon || '',
      highlightColor,
      tweetType: type,
    };
    
    setTweets(prev => [eventTweet, ...prev]);
  }, []);

  // AI processing — collect all images from a tweet (skip videos)
  const collectAllImagesForAi = useCallback(async (tweet: Tweet): Promise<string[]> => {
    const imgs: string[] = [];
    const add = (url: string) => { if (url && !imgs.includes(url)) imgs.push(url); };
    const videoUrls: string[] = [];
    tweet.media?.forEach(m => { if (m.type === 'video') videoUrls.push(m.url); else add(m.url); });
    if (tweet.imageUrl) add(tweet.imageUrl);
    tweet.quotedTweet?.media?.forEach(m => { if (m.type === 'video') videoUrls.push(m.url); else add(m.url); });
    if (tweet.quotedTweet?.imageUrl) add(tweet.quotedTweet.imageUrl);
    tweet.repliedToTweet?.media?.forEach(m => { if (m.type === 'video') videoUrls.push(m.url); else add(m.url); });
    if (tweet.repliedToTweet?.imageUrl) add(tweet.repliedToTweet.imageUrl);
    tweet.linkPreviews?.forEach(lp => { if (lp.image) add(lp.image); });
    // Followed user profile pic
    if (tweet.followedUser?.profilePic) add(tweet.followedUser.profilePic);

    // Collect ALL URLs to try OG image extraction on
    const ogUrlsToTry: string[] = [];

    // From linkPreviews — try all of them (with or without existing image)
    if (tweet.linkPreviews) {
      tweet.linkPreviews.forEach(lp => {
        if (lp.url && !lp.url.includes('twitter.com') && !lp.url.includes('x.com')) {
          ogUrlsToTry.push(lp.url);
        }
      });
    }

    // From tweet text — extract any URLs not already covered
    const allText = [tweet.text, tweet.quotedTweet?.text, tweet.repliedToTweet?.text].filter(Boolean).join(' ');
    const urlsInText = allText.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g) || [];
    const coveredUrls = new Set(ogUrlsToTry);
    urlsInText.forEach(u => {
      if (!coveredUrls.has(u) && !u.includes('twitter.com') && !u.includes('x.com')) {
        ogUrlsToTry.push(u);
      }
    });

    // Fetch OG images for all collected URLs (use link-metadata which is more robust)
    if (ogUrlsToTry.length > 0) {
      const ogFetches = ogUrlsToTry.slice(0, 4).map(async u => {
        try {
          const res = await fetch(`/api/link-metadata?url=${encodeURIComponent(u)}`);
          const data = await res.json();
          if (data.image) {
            add(data.image);
            // Also write back to the linkPreview object so Panel3 doesn't re-fetch
            const lp = tweet.linkPreviews?.find(l => l.url === u);
            if (lp && !lp.image) lp.image = data.image;
          }
        } catch {}
      });
      await Promise.all(ogFetches);
    }

    // Extract first frame from videos (always try, don't gate on imgs.length)
    if (videoUrls.length > 0) {
      const thumbPromises = videoUrls.slice(0, 2).map(vUrl => new Promise<string | null>(resolve => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.src = `/api/proxy-image?url=${encodeURIComponent(vUrl)}`;
        video.muted = true; video.playsInline = true; video.preload = 'auto';
        let done = false;
        const finish = (result: string | null) => { if (done) return; done = true; video.src = ''; video.load(); resolve(result); };
        video.addEventListener('loadeddata', () => { video.currentTime = Math.min(1, video.duration * 0.1); });
        video.addEventListener('seeked', () => {
          try {
            const c = document.createElement('canvas');
            c.width = video.videoWidth || 320; c.height = video.videoHeight || 180;
            const ctx = c.getContext('2d');
            if (ctx) { ctx.drawImage(video, 0, 0, c.width, c.height); finish(c.toDataURL('image/jpeg', 0.8)); return; }
          } catch {}
          finish(null);
        });
        video.addEventListener('error', () => finish(null));
        setTimeout(() => finish(null), 10000);
      }));
      const thumbs = await Promise.all(thumbPromises);
      thumbs.forEach(t => { if (t) add(t); });
    }

    // Use profile pic as last resort
    if (imgs.length === 0 && tweet.profilePic) add(tweet.profilePic);
    return imgs;
  }, []);

  // AI processing — for every incoming tweet
  useEffect(() => {
    if (!latestTweet) return;
    if (latestTweet.id === aiLastProcessedRef.current) return;
    aiQueuedIdsRef.current.delete(latestTweet.id);

    // Check if AI is enabled
    const aiEnabled = typeof window !== 'undefined' ? storeGet('ai-enabled') !== 'false' : true;
    if (!aiEnabled) return;

    // Skip deletes, follows
    const skipTypes = ['DELETED', 'FOLLOW', 'UNFOLLOW', 'DEACTIVATION'];
    if (latestTweet.tweetType && skipTypes.includes(latestTweet.tweetType)) return;

    // For retweets, use quotedTweet text
    const aiText = latestTweet.isRetweet
      ? (latestTweet.quotedTweet?.text || '')
      : (latestTweet.text || '');
    const aiAccount = latestTweet.isRetweet
      ? (latestTweet.quotedTweet?.username || latestTweet.username)
      : latestTweet.username;

    if (aiText.length < 10) return;

    aiLastProcessedRef.current = latestTweet.id;

    const tweetId = latestTweet.id;
    const tweetRef = latestTweet;

    // Fetch AI suggestions and OG images in parallel
    Promise.all([
      collectAllImagesForAi(tweetRef),
      fetch('/api/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: aiAccount, text: aiText }),
      }).then(r => r.json()),
    ])
      .then(async ([tweetImages, data]) => {
        const suggestions: Array<{ name: string; ticker: string }> = data.suggestions
          ? data.suggestions.map((s: { name: string; ticker?: string }) => ({
              name: s.name,
              ticker: (s.ticker || s.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13),
            }))
          : data.name ? [{ name: data.name, ticker: (data.ticker || data.name).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13) }] : [];

        if (suggestions.length > 0) {
          // Generate ASCII art image for the primary suggestion and prepend it
          let images = tweetImages;
          try {
            const asciiDataUrl = await generatePresetImage('ASCII Art', suggestions[0].ticker);
            if (asciiDataUrl) images = [asciiDataUrl, ...tweetImages];
          } catch {}

          setAiResults(prev => ({
            ...prev,
            [tweetId]: {
              name: suggestions[0].name,
              ticker: suggestions[0].ticker,
              images,
              suggestions,
            },
          }));

        }
      })
      .catch(() => {});
  }, [latestTweet, collectAllImagesForAi]);

  // Cap tweets to prevent unbounded growth
  useEffect(() => {
    if (tweets.length > MAX_TWEETS) {
      setTweets(prev => prev.slice(0, MAX_TWEETS));
    }
  }, [tweets.length]);

  // Auto-cleanup old AI results — keep only entries for tweets still in the list
  useEffect(() => {
    const tweetIds = new Set(tweets.map(t => t.id));
    setAiResults(prev => {
      const keys = Object.keys(prev);
      const stale = keys.filter(k => !tweetIds.has(k));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach(k => delete next[k]);
      return next;
    });
  }, [tweets]);

  // Conditional API connection based on USE_BARK_API toggle
  const { isConnected: j7Connected, error: j7Error } = USE_BARK_API ? 
    { isConnected: false, error: null } : 
    useJ7Feed({
      jwtToken: J7_JWT_TOKEN,
      onTweetReceived: handleTweetReceived,
      onInitialTweets: handleInitialTweets,
      onTweetDeleted: handleTweetDeleted,
      onFollow: handleFollow,
      onUnfollow: handleUnfollow,
      onDeactivation: handleDeactivation,
    });

  const { isConnected: barkConnected, error: barkError } = USE_BARK_API ?
    useBarkFeed({
      token: BARK_TOKEN,
      onTweetReceived: handleTweetReceived,
      onInitialTweets: handleInitialTweets,
      onTweetDeleted: handleTweetDeleted,
      onFollow: handleFollow,
      onUnfollow: handleUnfollow,
      onProfileChange: handleProfileChange,
    }) :
    { isConnected: false, error: null };

  // Use the active connection status
  const isConnected = USE_BARK_API ? barkConnected : j7Connected;

  // Load presets from localStorage on mount
  useEffect(() => {
    const savedPresets = storeGet('customPresets');
    if (savedPresets) {
      try {
        setCustomPresets(JSON.parse(savedPresets));
      } catch (error) {
        console.error('Failed to load presets from store:', error);
      }
    }
  }, []);

  // Save presets to localStorage whenever they change
  useEffect(() => {
    if (customPresets.length > 0) {
      storeSet('customPresets', JSON.stringify(customPresets));
    } else {
      storeRemove('customPresets');
    }
  }, [customPresets]);

  // Global keybind listener for Custom Presets
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
      // Skip plain keypresses in input fields, but allow modifier combos (Alt+A, Ctrl+X, etc.)
      if (!hasModifier && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) return;

      const key = e.key.toUpperCase();
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      const pressedKeybind = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;

      const matchingPreset = customPresets.find(p => p.keybind === pressedKeybind);
      
      if (matchingPreset) {
        const selection = window.getSelection();
        let selectedText = selection?.toString().trim() || '';

        // If no text selected, check if the deploy panel name input has a value (from double-click fill)
        if (!selectedText) {
          const nameInput = document.querySelector('input[placeholder="Token name"], input[placeholder="Coin name"]') as HTMLInputElement;
          if (nameInput?.value?.trim()) {
            selectedText = nameInput.value.trim();
          }
        }

        // If still no text, use the latest tweet's display name or first word of text
        if (!selectedText && tweets.length > 0) {
          const latest = tweets[0];
          selectedText = latest.displayName || latest.username || '';
        }

        if (!selectedText) return;

        // Helper function to check if text exists in a tweet (including nested tweets)
        const textMatchesTweet = (tweet: Tweet, searchText: string): boolean => {
          const lowerSearch = searchText.toLowerCase();
          if (tweet.text && tweet.text.toLowerCase().includes(lowerSearch)) return true;
          if (tweet.quotedTweet?.text && tweet.quotedTweet.text.toLowerCase().includes(lowerSearch)) return true;
          if (tweet.repliedToTweet?.text && tweet.repliedToTweet.text.toLowerCase().includes(lowerSearch)) return true;
          // Also match by display name / username
          if (tweet.displayName?.toLowerCase().includes(lowerSearch)) return true;
          if (tweet.username?.toLowerCase().includes(lowerSearch)) return true;
          return false;
        };

        // Helper function to extract the best image from a tweet (NO profile pics - let ASCII generate)
        const getBestImageForPreset = (tweet: Tweet): string | undefined => {
          // Helper to check if URL is a profile picture (skip these)
          const isProfilePic = (url: string | undefined): boolean => {
            if (!url) return false;
            if (tweet.profilePic && url === tweet.profilePic) return true;
            if (tweet.quotedTweet?.profilePic && url === tweet.quotedTweet.profilePic) return true;
            if (tweet.repliedToTweet?.profilePic && url === tweet.repliedToTweet.profilePic) return true;
            if (url.includes('profile_images') || url.includes('_normal') || url.includes('_bigger')) return true;
            return false;
          };
          
          let imageUrl = tweet.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          // Video thumbnail fallback
          const vidThumb = tweet.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (vidThumb && !isProfilePic(vidThumb)) return vidThumb;
          if (tweet.imageUrl && !isProfilePic(tweet.imageUrl)) return tweet.imageUrl;
          imageUrl = tweet.quotedTweet?.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          const qtVidThumb = tweet.quotedTweet?.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (qtVidThumb && !isProfilePic(qtVidThumb)) return qtVidThumb;
          if (tweet.quotedTweet?.imageUrl && !isProfilePic(tweet.quotedTweet.imageUrl)) return tweet.quotedTweet.imageUrl;
          imageUrl = tweet.repliedToTweet?.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          const rtVidThumb = tweet.repliedToTweet?.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (rtVidThumb && !isProfilePic(rtVidThumb)) return rtVidThumb;
          if (tweet.repliedToTweet?.imageUrl && !isProfilePic(tweet.repliedToTweet.imageUrl)) return tweet.repliedToTweet.imageUrl;
          // Priority 7: Link preview images (article thumbnails)
          const lpImage = tweet.linkPreviews?.find(lp => lp.image)?.image;
          if (lpImage && !isProfilePic(lpImage)) return lpImage;
          // No actual image found - return undefined so ASCII art generates
          return undefined;
        };

        let tweetImageUrl: string | undefined = undefined;
        let tweetLink: string | undefined = undefined;

        // Always find the matching tweet for link + image
        const matchingTweet = tweets.find(tweet => textMatchesTweet(tweet, selectedText)) || (tweets.length > 0 ? tweets[0] : undefined);
        if (matchingTweet) {
          tweetLink = buildTweetUrl(matchingTweet.username, matchingTweet.twitterStatusId);
          if (matchingPreset.imageType === 'Image in Post') {
            tweetImageUrl = getBestImageForPreset(matchingTweet);
          }
        }
        
        e.preventDefault();
        setPresetTrigger({
          namePrefix: matchingPreset.namePrefix,
          nameSuffix: matchingPreset.nameSuffix,
          deployPlatform: matchingPreset.deployPlatform,
          tickerMode: matchingPreset.tickerMode,
          imageType: matchingPreset.imageType,
          selectedText,
          tweetImageUrl,
          tweetLink,
          customImageUrl: matchingPreset.customImageUrl,
        });
      }
    };

    document.addEventListener('keydown', handleGlobalKeyPress);
    return () => document.removeEventListener('keydown', handleGlobalKeyPress);
  }, [customPresets, tweets]);

  // Global keybind listener for Insta-Deploy
  useEffect(() => {
    const handleInstaDeployKeyPress = async (e: KeyboardEvent) => {
      // Don't trigger in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Load settings from localStorage
      const primaryKeybind = storeGet('insta-deploy-primary') || 'Ctrl + X';
      const secondaryKeybind = storeGet('insta-deploy-secondary') || '';

      // Build pressed keybind string
      const modifiers = [];
      if (e.ctrlKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');
      if (e.metaKey) modifiers.push('Meta');
      
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const pressedKeybind = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${key}` : key;

      // Check if it matches primary or secondary keybind
      const isMatch = pressedKeybind === primaryKeybind || 
                     (secondaryKeybind && pressedKeybind === secondaryKeybind);

      if (isMatch) {
        e.preventDefault();
        
        // Get selected text
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        
        if (!selectedText) {
          return;
        }

        // Helper function to check if text exists in a tweet (including nested tweets)
        const textMatchesTweet = (tweet: Tweet, searchText: string): boolean => {
          const lowerSearch = searchText.toLowerCase();
          // Check main tweet text
          if (tweet.text && tweet.text.toLowerCase().includes(lowerSearch)) return true;
          // Check quoted tweet text (for retweets/quotes where main text might be empty)
          if (tweet.quotedTweet?.text && tweet.quotedTweet.text.toLowerCase().includes(lowerSearch)) return true;
          // Check replied-to tweet text
          if (tweet.repliedToTweet?.text && tweet.repliedToTweet.text.toLowerCase().includes(lowerSearch)) return true;
          return false;
        };

        // Helper function to extract the best image from a tweet (NO profile pics - let ASCII generate)
        const getBestImage = (tweet: Tweet): string | undefined => {
          // Helper to check if URL is a profile picture (skip these)
          const isProfilePic = (url: string | undefined): boolean => {
            if (!url) return false;
            // Check if it matches any known profile pic URL
            if (tweet.profilePic && url === tweet.profilePic) return true;
            if (tweet.quotedTweet?.profilePic && url === tweet.quotedTweet.profilePic) return true;
            if (tweet.repliedToTweet?.profilePic && url === tweet.repliedToTweet.profilePic) return true;
            // Also check for common profile pic URL patterns
            if (url.includes('profile_images') || url.includes('_normal') || url.includes('_bigger')) return true;
            return false;
          };
          
          // Priority 1: Main tweet media
          let imageUrl = tweet.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          // Video thumbnail fallback
          const vidThumb2 = tweet.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (vidThumb2 && !isProfilePic(vidThumb2)) return vidThumb2;

          // Priority 2: Main tweet imageUrl (but not if it's the profile pic)
          if (tweet.imageUrl && !isProfilePic(tweet.imageUrl)) return tweet.imageUrl;

          // Priority 3: Quoted tweet media (for retweets)
          imageUrl = tweet.quotedTweet?.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          const qtVidThumb2 = tweet.quotedTweet?.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (qtVidThumb2 && !isProfilePic(qtVidThumb2)) return qtVidThumb2;

          // Priority 4: Quoted tweet imageUrl
          if (tweet.quotedTweet?.imageUrl && !isProfilePic(tweet.quotedTweet.imageUrl)) return tweet.quotedTweet.imageUrl;

          // Priority 5: Replied-to tweet media
          imageUrl = tweet.repliedToTweet?.media?.find(m => m.type === 'image' || m.type === 'gif')?.url;
          if (imageUrl && !isProfilePic(imageUrl)) return imageUrl;
          const rtVidThumb2 = tweet.repliedToTweet?.media?.find(m => m.type === 'video' && m.thumbnail)?.thumbnail;
          if (rtVidThumb2 && !isProfilePic(rtVidThumb2)) return rtVidThumb2;

          // Priority 6: Replied-to tweet imageUrl
          if (tweet.repliedToTweet?.imageUrl && !isProfilePic(tweet.repliedToTweet.imageUrl)) return tweet.repliedToTweet.imageUrl;

          // Priority 7: Link preview images (article thumbnails)
          const lpImage = tweet.linkPreviews?.find(lp => lp.image)?.image;
          if (lpImage && !isProfilePic(lpImage)) return lpImage;

          // No actual image found - return undefined so ASCII art generates
          return undefined;
        };

        // Find the tweet containing this text (search main text, quoted text, and replied text)
        const matchingTweet = tweets.find(tweet => textMatchesTweet(tweet, selectedText));

        // Get tweet image using enhanced extraction
        let tweetImageUrl = matchingTweet ? getBestImage(matchingTweet) : undefined;

        // If no image found, try OG image from article links
        if (!tweetImageUrl && matchingTweet) {
          const ogUrls: string[] = [];
          matchingTweet.linkPreviews?.forEach(lp => {
            if (lp.url && !lp.url.includes('twitter.com') && !lp.url.includes('x.com')) ogUrls.push(lp.url);
          });
          const textUrls = matchingTweet.text.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g) || [];
          const covered = new Set(ogUrls);
          textUrls.forEach(u => { if (!covered.has(u) && !u.includes('twitter.com') && !u.includes('x.com') && !u.includes('t.co')) ogUrls.push(u); });
          for (const u of ogUrls.slice(0, 3)) {
            try {
              const res = await fetch(`/api/og-image?url=${encodeURIComponent(u)}`);
              const data = await res.json();
              if (data.image) { tweetImageUrl = data.image; break; }
            } catch {}
          }
        }

        // Build tweet link
        let tweetLink: string | undefined;
        if (matchingTweet) {
          const username = matchingTweet.username;
          if (username) {
            tweetLink = buildTweetUrl(username, matchingTweet.twitterStatusId);
          }
        }
        
        // Trigger deployment with "Selected Text" ticker mode
        setPresetTrigger({
          namePrefix: '',
          nameSuffix: '',
          deployPlatform: 'Use Account Default',
          tickerMode: 'Selected Text',
          imageType: 'Image in Post',
          selectedText,
          tweetImageUrl,
          tweetLink,
        });
      }
    };

    document.addEventListener('keydown', handleInstaDeployKeyPress);
    return () => document.removeEventListener('keydown', handleInstaDeployKeyPress);
  }, [tweets]);

  // Fetch real tweet data using our server-side API route
  const fetchTweetData = async (tweetId: string) => {
    try {
      const response = await fetch(`/api/tweet?id=${tweetId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch tweet:', error);
      return null;
    }
  };

  // Parse Twitter URL and create tweet
  const parseTweetUrl = async (url: string) => {
    const twitterPattern = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/([^\/]+)\/status\/(\d+)/i;
    const match = url.match(twitterPattern);
    
    if (!match) return null;
    
    const username = match[1];
    const tweetId = match[2];
    const tweetData = await fetchTweetData(tweetId);
    
    if (!tweetData) return null;
    
    const customNotif = customNotifications.find(n => 
      n.username.toLowerCase() === tweetData.handle.toLowerCase()
    );
    
    // Extract link previews from tweet text
    const linkPreviews: Array<{url: string; title?: string; description?: string; image?: string; domain?: string}> = [];
    if (tweetData.text) {
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
      const urls = tweetData.text.match(urlRegex) || [];
      urls.forEach((u: string) => {
        if (!u.includes('twitter.com') && !u.includes('x.com')) {
          linkPreviews.push({ url: u });
        }
      });
    }

    return {
      id: `${tweetId}-${Date.now()}-${Math.random()}`,
      username: tweetData.username.replace(/^@/, ''),
      displayName: tweetData.displayName,
      handle: tweetData.handle,
      verified: tweetData.verified,
      timestamp: tweetData.timestamp,
      text: tweetData.text,
      imageUrl: tweetData.imageUrl,
      media: tweetData.media,
      profilePic: tweetData.profilePic,
      twitterStatusId: tweetData.twitterStatusId || tweetId,
      highlightColor: customNotif?.color,
      linkPreviews: linkPreviews.length > 0 ? linkPreviews : undefined,
    };
  };

  // Handle chat input submission
  const handleChatSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && chatInput.trim()) {
      const url = chatInput.trim();
      setChatInput('');
      
      try {
        const tweet = await parseTweetUrl(url);
        
        if (tweet) {
          // Queue for AI processing (pasted URLs only)
          aiQueuedIdsRef.current.add(tweet.id);
          setTweets(prev => [tweet, ...prev]);
          setLatestTweet(tweet);

          const customNotif = customNotifications.find(n =>
            n.username.toLowerCase() === tweet.handle.toLowerCase()
          );

          if (customNotif && customNotif.sound !== "None (Highlight Only)") {
            playNotificationSound(customNotif.sound);
          }
        }
      } catch (error) {
        console.error('Error processing tweet:', error);
      }
    }
  };


  // Pre-compute AI picks data so the render path stays cheap
  const aiPicksData = useMemo(() => {
    return tweets
      .filter(t => aiResults[t.id]?.suggestions?.length)
      .flatMap(t => {
        const ai = aiResults[t.id];
        const tweetUrl = buildTweetUrl(t.username, t.twitterStatusId);
        return (ai.suggestions || [{ name: ai.name, ticker: ai.ticker }]).slice(0, 3).map((sug, idx) => {
          const sugNameLower = sug.name.toLowerCase();
          const sugTickerLower = sug.ticker.toLowerCase();
          const folderMatch = browserImages.find(bi => {
            const fn = bi.nameWithoutExt.toLowerCase();
            return fn === sugNameLower || fn === sugTickerLower;
          });
          const folderImgUrl = folderMatch ? `/api/local-images/serve?file=${encodeURIComponent(folderMatch.filename)}` : null;
          // Distribute tweet images across suggestions (each gets a different image when available)
          const tweetImg = ai.images?.[idx % (ai.images?.length || 1)] || ai.images?.[0];
          const img = folderImgUrl || tweetImg;
          const allTweetImages = folderImgUrl
            ? [folderImgUrl, ...(ai.images || [])]
            : (ai.images || []);
          return { key: `${t.id}-${idx}`, sug, img, allTweetImages, tweetUrl, username: t.username };
        });
      }).slice(0, 20);
  }, [tweets, aiResults, browserImages]);

  // ─── Panel content renderer ───
  const renderPanelContent = useCallback((panelId: string) => {
    switch (panelId) {
      case 'deploy':
        return (
          <div className="relative h-full">
            {deployFlash && (
              <div className="absolute inset-0 z-10 pointer-events-none rounded-md border-2 border-blue-500/60 animate-[flash_0.6s_ease-out_forwards]" />
            )}
            <Panel1
              themeId={currentTheme}
              activeWallet={activeWallet}
              wallets={wallets}
              onWalletSelect={setActiveWallet}
              presetTrigger={presetTrigger}
              onPresetApplied={() => setPresetTrigger(null)}
              deployedImageUrl={deployedImageUrl}
              deployedImageOptions={deployedImageOptions}
              deployedTwitterUrl={deployedTwitterUrl}
              forceSelectImage={forceSelectImage}
              onImageDeployed={() => { setDeployedImageUrl(null); setDeployedImageOptions([]); setForceSelectImage(false); }}
              onTwitterDeployed={() => setDeployedTwitterUrl(null)}
              clearTrigger={clearTrigger}
              tweets={tweets}
              testMode={testMode}
              onNameChange={setPanel1NameValue}
              onTokenSearch={(query: string) => setTokenSearchQuery(query)}
              vampData={vampData}
              onVampApplied={() => setVampData(null)}
              settingsVersion={settingsVersion}
              browserImages={browserImages}
              editMode={editMode}
            />
          </div>
        );
      case 'search':
        return (
          <TokenSearch
            themeId={currentTheme}
            onTokenSelected={(token: TokenResult) => {
              setVampData({
                tokenName: token.name || "",
                tokenSymbol: token.symbol || "",
                tokenImage: token.imageUrl || "",
                website: "",
                twitter: "",
              });
            }}
            onImageOnly={(imageUrl: string) => {
              setDeployedImageUrl(imageUrl);
              setForceSelectImage(true);
            }}
            onSearchImages={(imageUrls: string[]) => {
              if (imageUrls.length > 0) {
                setDeployedImageOptions(imageUrls);
                setDeployedImageUrl(imageUrls[0]);
                setForceSelectImage(false);
              }
            }}
            externalQuery={tokenSearchQuery}
          />
        );
      case 'images':
        return (
          <ImageBrowser
            themeId={currentTheme}
            filterText={panel1NameValue}
            onImageSelected={(imageUrl: string) => {
              setDeployedImageUrl(imageUrl);
              setPanel2SelectedImagePath(imageUrl);
              setForceSelectImage(true);
            }}
            selectedImagePath={panel2SelectedImagePath}
            onImagesLoaded={handleBrowserImagesLoaded}
          />
        );
      case 'canvas':
        return (
          <Canvas
            themeId={currentTheme}
            onImageSelected={(imageUrl: string) => {
              setDeployedImageUrl(imageUrl);
            }}
          />
        );
      case 'ai':
        return (
          <div className={`h-full ${theme.panel1ContentBg} glass-panel flex flex-col overflow-hidden`}>
            <div className="panel-header flex items-center justify-between">
              <span className="section-label">AI Picks</span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-white/15 font-medium">{(typeof window !== 'undefined' && storeGet('ai-fill-modifier')) || 'Alt'}+click = edit</span>
                {aiPicksData.length > 0 && (
                  <button
                    onClick={() => setAiResults({})}
                    className="text-[9px] text-white/20 hover:text-white/50 transition-colors"
                    title="Clear all AI picks"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1" style={{ contain: 'content' }}>
              {aiPicksData.map(({ key, sug, img, allTweetImages, tweetUrl, username }) => (
                      <div
                        key={key}
                        className="w-full rounded-md border border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08] group cursor-pointer"
                        onClick={(e) => {
                          const mod = storeGet('ai-fill-modifier') || 'Alt';
                          const held = mod === 'Alt' ? e.altKey : mod === 'Ctrl' ? e.ctrlKey : mod === 'Shift' ? e.shiftKey : e.altKey;
                          if (held) {
                            startTransition(() => {
                              setClearTrigger(prev => prev + 1);
                              setVampData({ tokenName: sug.name, tokenSymbol: sug.ticker, tokenImage: img || '', website: '', twitter: tweetUrl });
                              if (allTweetImages.length > 0) { setDeployedImageOptions(allTweetImages); setDeployedImageUrl(allTweetImages[0]); }
                              setDeployedTwitterUrl(tweetUrl);
                              setTokenSearchQuery(sug.name);
                            });
                          } else {
                            setClearTrigger(prev => prev + 1);
                            setPresetTrigger({ namePrefix: '', nameSuffix: '', deployPlatform: 'Pump', tickerMode: 'Selected Text', imageType: img ? 'Image in Post' : 'Letter Image', selectedText: sug.name, overrideTicker: sug.ticker, tweetImageUrl: img || undefined, tweetLink: tweetUrl });
                            startTransition(() => { setTokenSearchQuery(sug.name); });
                          }
                        }}
                      >
                        <div className="flex items-center gap-1.5 p-1">
                          {img ? (
                            <img
                              src={img.startsWith('data:') || img.startsWith('/') ? img : `/api/proxy-image?url=${encodeURIComponent(img)}`}
                              alt=""
                              className="w-9 h-9 rounded flex-shrink-0 object-cover border border-white/[0.08]"
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded flex-shrink-0 bg-white/[0.04] flex items-center justify-center text-[10px] text-white/15 font-bold">
                              {sug.ticker?.[0] || '?'}
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="text-[10px] text-white/70 font-semibold truncate group-hover:text-emerald-400 text-left">{sug.name}</div>
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] text-emerald-400/60 font-bold">${sug.ticker}</span>
                              <span className="text-[7px] text-white/15 truncate">@{username}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {([
                              { platform: 'Pump', src: '/images/pump-logo.png', alt: 'P' },
                              { platform: 'Raydium', src: '/images/bonk-logo.png', alt: 'B' },
                              { platform: 'USD1', src: '/images/usd1-logo.png', alt: 'U' },
                              { platform: 'Meteora', src: '/images/bags-logo.png', alt: 'M' },
                            ] as const).map((p) => (
                              <button
                                key={p.platform}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const mod = storeGet('ai-fill-modifier') || 'Alt';
                                  const held = mod === 'Alt' ? e.altKey : mod === 'Ctrl' ? e.ctrlKey : mod === 'Shift' ? e.shiftKey : e.altKey;
                                  if (held) {
                                    startTransition(() => {
                                      setClearTrigger(prev => prev + 1);
                                      setVampData({ tokenName: sug.name, tokenSymbol: sug.ticker, tokenImage: img || '', website: '', twitter: tweetUrl });
                                      if (allTweetImages.length > 0) { setDeployedImageOptions(allTweetImages); setDeployedImageUrl(allTweetImages[0]); }
                                      setDeployedTwitterUrl(tweetUrl);
                                      setTokenSearchQuery(sug.name);
                                    });
                                  } else {
                                    setClearTrigger(prev => prev + 1);
                                    setPresetTrigger({ namePrefix: '', nameSuffix: '', deployPlatform: p.platform, tickerMode: 'Selected Text', imageType: img ? 'Image in Post' : 'Letter Image', selectedText: sug.name, overrideTicker: sug.ticker, tweetImageUrl: img || undefined, tweetLink: tweetUrl });
                                    startTransition(() => { setTokenSearchQuery(sug.name); });
                                  }
                                }}
                                className="w-7 h-7 rounded-md flex items-center justify-center bg-white/[0.05] hover:bg-white/[0.15] border border-white/[0.08] hover:border-white/25 transition-all"
                                title={p.platform}
                              >
                                <img src={p.src} alt={p.alt} className="w-5 h-5 object-contain" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                  ))}
            </div>
          </div>
        );
      case 'feed':
        return (
          <Panel3
            themeId={currentTheme}
            tweets={tweets}
            customNotifications={customNotifications}
            defaultColor={defaultColor}
            onDeploy={(images: string[], twitterUrl: string) => {
              setClearTrigger(prev => prev + 1);
              setDeployedImageOptions(images);
              setDeployedImageUrl(images[0] || null);
              setDeployedTwitterUrl(twitterUrl);
            }}
            onFollowDeploy={(name, symbol, imageUrl, twitterUrl) => {
              setClearTrigger(prev => prev + 1);
              setPresetTrigger({
                namePrefix: '',
                nameSuffix: '',
                deployPlatform: 'Pump',
                tickerMode: 'Selected Text',
                imageType: imageUrl ? 'Image in Post' : 'Letter Image',
                selectedText: name,
                overrideTicker: symbol.replace(/^@/, '').toUpperCase(),
                tweetImageUrl: imageUrl || undefined,
                tweetLink: twitterUrl,
              });
              setTokenSearchQuery(name);
            }}
            aiResults={aiResults}
            browserImages={browserImages}
            onAiDeploy={(name, ticker, imageUrl, tweetId, platform) => {
              const tweet = tweets.find(t => t.id === tweetId);
              const tweetUrl = tweet
                ? buildTweetUrl(tweet.username, tweet.twitterStatusId)
                : '';
              setClearTrigger(prev => prev + 1);
              setPresetTrigger({
                namePrefix: '',
                nameSuffix: '',
                deployPlatform: platform || 'Use Account Default',
                tickerMode: 'Selected Text',
                imageType: imageUrl ? 'Image in Post' : 'Letter Image',
                selectedText: name,
                overrideTicker: ticker,
                tweetImageUrl: imageUrl || undefined,
                tweetLink: tweetUrl,
              });
              setTokenSearchQuery(name);
            }}
            onAiFillForm={(name, ticker, images, tweetId) => {
              const tweet = tweets.find(t => t.id === tweetId);
              const tweetUrl = tweet
                ? buildTweetUrl(tweet.username, tweet.twitterStatusId)
                : '';
              setClearTrigger(prev => prev + 1);
              setVampData({
                tokenName: name,
                tokenSymbol: ticker,
                tokenImage: images[0] || '',
                website: '',
                twitter: tweetUrl,
              });
              setDeployedImageOptions(images);
              setDeployedImageUrl(images[0] || null);
              setDeployedTwitterUrl(tweetUrl);
              setTokenSearchQuery(name);
              try {
                const tmpSpan = document.createElement('span');
                tmpSpan.textContent = name;
                tmpSpan.style.position = 'fixed';
                tmpSpan.style.left = '-9999px';
                tmpSpan.style.top = '-9999px';
                tmpSpan.style.opacity = '0';
                document.body.appendChild(tmpSpan);
                const range = document.createRange();
                range.selectNodeContents(tmpSpan);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                document.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                setTimeout(() => {
                  sel?.removeAllRanges();
                  tmpSpan.remove();
                }, 100);
              } catch {}
            }}
            feedPaused={feedPaused}
            onHoverChange={handleFeedHover}
            bufferedCount={bufferedCount}
            onClearFeed={() => { setTweets([]); setAiResults({}); }}
          />
        );
      default:
        return null;
    }
  }, [currentTheme, activeWallet, wallets, presetTrigger, deployedImageUrl, deployedImageOptions, deployedTwitterUrl, clearTrigger, tweets, testMode, panel1NameValue, tokenSearchQuery, vampData, settingsVersion, panel2SelectedImagePath, theme, aiResults, customNotifications, defaultColor, browserImages, feedPaused, bufferedCount, handleFeedHover, handleBrowserImagesLoaded]);

  // Launch tweet handler for Launchblitz layout — mirrors Panel3's onDeploy
  const handleLaunchTweet = useCallback((tweet: Tweet) => {
    const statusId = tweet.twitterStatusId?.replace(/^[a-zA-Z-]+/, '');
    const url = statusId && /^\d+$/.test(statusId)
      ? `https://x.com/${tweet.username}/status/${statusId}`
      : `https://x.com/${tweet.username}`;
    // Extract all images from tweet (same logic as Panel3's collectAllImages)
    const images: string[] = [];
    const add = (u: string) => { if (u && !images.includes(u)) images.push(u); };
    tweet.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
    if (tweet.imageUrl) add(tweet.imageUrl);
    tweet.quotedTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
    if (tweet.quotedTweet?.imageUrl) add(tweet.quotedTweet.imageUrl);
    tweet.repliedToTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
    if (tweet.repliedToTweet?.imageUrl) add(tweet.repliedToTweet.imageUrl);
    tweet.linkPreviews?.forEach(lp => { if (lp.image) add(lp.image); });
    if (tweet.followedUser?.profilePic) add(tweet.followedUser.profilePic);
    if (tweet.profilePic) add(tweet.profilePic);
    setClearTrigger(prev => prev + 1);
    if (images.length > 0) {
      setDeployedImageOptions(images);
      setDeployedImageUrl(images[0]);
    }
    setDeployedTwitterUrl(url);
  }, []);

  // Render deploy panel for Launchblitz layout
  const renderDeployPanelForLB = useCallback(() => {
    return (
      <div className="relative h-full">
        {deployFlash && (
          <div className="absolute inset-0 z-10 pointer-events-none rounded-md border-2 border-blue-500/60 animate-[flash_0.6s_ease-out_forwards]" />
        )}
        <Panel1
          themeId={currentTheme}
          activeWallet={activeWallet}
          wallets={wallets}
          onWalletSelect={setActiveWallet}
          presetTrigger={presetTrigger}
          onPresetApplied={() => setPresetTrigger(null)}
          deployedImageUrl={deployedImageUrl}
          deployedImageOptions={deployedImageOptions}
          deployedTwitterUrl={deployedTwitterUrl}
          forceSelectImage={forceSelectImage}
          onImageDeployed={() => { setDeployedImageUrl(null); setDeployedImageOptions([]); setForceSelectImage(false); }}
          onTwitterDeployed={() => setDeployedTwitterUrl(null)}
          clearTrigger={clearTrigger}
          tweets={tweets}
          testMode={testMode}
          onNameChange={setPanel1NameValue}
          onTokenSearch={(query: string) => setTokenSearchQuery(query)}
          vampData={vampData}
          onVampApplied={() => setVampData(null)}
          settingsVersion={settingsVersion}
          browserImages={browserImages}
          editMode={false}
          variant="launchblitz"
        />
      </div>
    );
  }, [currentTheme, activeWallet, wallets, presetTrigger, deployedImageUrl, deployedImageOptions, deployedTwitterUrl, forceSelectImage, clearTrigger, tweets, testMode, vampData, settingsVersion, browserImages, deployFlash]);

  // Render token search panel for Launchblitz layout
  const renderTokenSearchForLB = useCallback(() => {
    return (
      <div className="h-full lb-token-search">
        <TokenSearch
          themeId={currentTheme}
          variant="launchblitz"
          onTokenSelected={(token: TokenResult) => {
            setVampData({
              tokenName: token.name || "",
              tokenSymbol: token.symbol || "",
              tokenImage: token.imageUrl || "",
              website: "",
              twitter: "",
            });
          }}
          onImageOnly={(imageUrl: string) => {
            setDeployedImageUrl(imageUrl);
            setForceSelectImage(true);
          }}
          onSearchImages={(imageUrls: string[]) => {
            if (imageUrls.length > 0) {
              setDeployedImageOptions(imageUrls);
              setDeployedImageUrl(imageUrls[0]);
              setForceSelectImage(false);
            }
          }}
          externalQuery={tokenSearchQuery}
        />
      </div>
    );
  }, [currentTheme, tokenSearchQuery]);

  if (!mounted) return <div className="h-screen w-full bg-[#0a0a0a]" />;

  // Launchblitz layout
  if (uiPreference === 'launchblitz') {
    return (
      <>
        <Suspense fallback={<div className="h-screen w-full bg-[#0a0a0a]" />}>
          <LaunchblitzLayout
            tweets={tweets}
            isConnected={isConnected}
            onlineCount={onlineCount}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenDeploySettings={() => setIsDeploySettingsOpen(true)}
            onParseTweetUrl={(url) => parseTweetUrl(url)}
            onLaunchTweet={handleLaunchTweet}
            renderDeployPanel={renderDeployPanelForLB}
            renderTokenSearch={renderTokenSearchForLB}
            feedPaused={feedPaused}
            onHoverChange={handleFeedHover}
            bufferedCount={bufferedCount}
          />
        </Suspense>

        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={currentTheme} onThemeChange={setCurrentTheme}
          customNotifications={customNotifications} onCustomNotificationsChange={setCustomNotifications} defaultColor={defaultColor} onDefaultColorChange={setDefaultColor}
          highlightingEnabled={highlightingEnabled} onHighlightingEnabledChange={setHighlightingEnabled}
          highlightSoundsEnabled={highlightSoundsEnabled} onHighlightSoundsEnabledChange={setHighlightSoundsEnabled}
          keywords={keywords} onKeywordsChange={setKeywords}
          panelVisibility={panelVisibility} onTogglePanel={togglePanel} onResetLayout={resetLayout}
          panelOrder={panelOrder} onApplyPreset={applyPreset}
          showPrices={showPrices} onShowPricesChange={setShowPrices} />

        <DeploySettingsModal isOpen={isDeploySettingsOpen} onClose={() => { setIsDeploySettingsOpen(false); setSettingsVersion(v => v + 1); }} onWalletChange={setActiveWallet}
          wallets={wallets} onWalletsChange={setWallets}
          presets={customPresets} onPresetsChange={setCustomPresets} themeId={currentTheme} />

        <ImageLibraryModal
          isOpen={isImageLibraryOpen}
          onClose={() => setIsImageLibraryOpen(false)}
          onSelectImage={(imageUrl: string) => { setDeployedImageUrl(imageUrl); }}
          themeId={currentTheme}
        />

        <VampModal
          isOpen={isVampOpen}
          onClose={() => setIsVampOpen(false)}
          onResult={(data) => setVampData(data)}
        />
      </>
    );
  }

  // Default NNN layout
  return (
    <div ref={containerRef} className="flex flex-col h-screen w-full overflow-hidden">
      <div ref={headerRef} className={`w-full ${theme.header} border-b border-white/[0.06] select-none`}>
        <div className="flex items-center justify-center h-9 px-2 relative">
          {/* Live prices — far left */}
          {showPrices && (
            <div className="absolute left-2 flex items-center select-none">
              <div className="flex items-center gap-px bg-black/80 dark:bg-black/60 rounded-md border border-white/[0.08] overflow-hidden">
                {([
                  { coin: 'SOL', icon: '/images/sol-fill.svg' },
                  { coin: 'BTC', icon: '/images/btc-fill.svg' },
                  { coin: 'ETH', icon: '/images/eth-fill.svg' },
                ] as const).map(({ coin, icon }, i) => {
                  const price = prices[coin];
                  const prev = prevPrices.current[coin];
                  const direction = price && prev ? (price > prev ? 'up' : price < prev ? 'down' : 'flat') : 'flat';
                  const formatted = price
                    ? coin === 'BTC'
                      ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : '—';
                  return (
                    <div key={coin} className={`flex items-center gap-1.5 px-2.5 py-1 ${i > 0 ? 'border-l border-white/[0.06]' : ''}`}>
                      <img src={icon} alt={coin} width={13} height={13} draggable={false} className="opacity-70" />
                      <span className={`text-[11px] font-mono tabular-nums leading-none transition-colors duration-500 ${
                        direction === 'up' ? 'text-green-400' : direction === 'down' ? 'text-red-400' : 'text-white/50'
                      }`}>
                        {formatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Center group */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => {}}>
              <Home size={12} />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTestMode(!testMode)}
              className={testMode ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 hover:text-orange-400' : ''}
            >
              <Eye size={12} />
              <span>{testMode ? 'ON' : 'Test'}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setIsImageLibraryOpen(true)}>
              <Bookmark size={12} />
              <span>Saved</span>
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)}>
              <Settings size={12} />
            </Button>
          </div>

          <div className="w-px h-3.5 bg-white/[0.06] mx-2" />

          <div className="w-[260px]">
            <Input
              type="text"
              placeholder="Paste Twitter URL here..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatSubmit}
              className="h-6 text-[11px] bg-white/[0.03] border-white/[0.06] placeholder-white/15"
            />
          </div>

          <div className="w-px h-3.5 bg-white/[0.06] mx-2" />

          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => {}} title={`${onlineCount} user${onlineCount !== 1 ? 's' : ''} online`}>
              <Users size={12} />
              <span className="tabular-nums">{onlineCount}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                title={isConnected ? (USE_BARK_API ? 'Bark Connected' : 'J7 Connected') : (USE_BARK_API ? 'Bark Disconnected' : 'J7 Disconnected')}
              />
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setIsVampOpen(true)}>
              <Zap size={12} />
              <span>Vamp</span>
            </Button>

            <div className="w-px h-3.5 bg-white/[0.06] mx-1" />

            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 btn-deploy" onClick={() => {
              setClearTrigger(prev => prev + 1);
              setDeployFlash(true);
              setTimeout(() => setDeployFlash(false), 600);
            }}>
              Deploy
            </Button>

            <Button variant="ghost" size="icon" onClick={() => setIsDeploySettingsOpen(true)}>
              <SlidersHorizontal size={12} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setEditMode(!editMode); setDraggedPanel(null); setDragOverPanel(null); }}
              className={editMode ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/15 hover:text-blue-400' : ''}
              title={editMode ? 'Exit edit mode' : 'Edit panel layout'}
            >
              <Pencil size={11} />
            </Button>

            {editMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetLayout}
                className="text-white/40 hover:text-white/70"
                title="Reset to default layout"
              >
                <RotateCcw size={11} />
                <span className="text-[10px]">Reset</span>
              </Button>
            )}
          </div>

          {/* Chud.tech logo + logout — far right */}
          <div className="absolute right-2 flex items-center gap-1">
            <a
              href="https://chud.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-1.5 group select-none"
            >
              <img src="/images/chud.jpg" alt="" className="w-5 h-5 rounded-md object-cover transition-transform duration-200 group-hover:scale-110" />
              <span className="flex items-baseline">
                <span className="text-[12px] font-bold tracking-tight text-white/80 group-hover:text-white transition-colors">
                  Chud
                </span>
                <span className="text-[8px] font-bold text-red-500/80 tracking-wide group-hover:text-red-400 transition-colors">
                  .tech
                </span>
              </span>
            </a>
            <button
              onClick={() => {
                storeRemove('chud-api-key');
                document.cookie = 'chud-api-key=; path=/; max-age=0';
                window.location.reload();
              }}
              className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200"
              title="Log out"
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Panel area */}
      <div className="flex-1 w-full overflow-hidden relative">
        <PanelGroup key={JSON.stringify(visibleLayout)} id="nnn-panels" orientation="horizontal" className="h-full w-full">
          {visibleLayout.map((slot, colIndex) => {
            const isStack = Array.isArray(slot);
            const colKey = isStack ? slot.join('-') : slot;

            const colMinSize = isStack ? '12%' : (panelSizeConfig[slot as string]?.minSize);
            const colMaxSize = isStack ? undefined : (panelSizeConfig[slot as string]?.maxSize);

            return (
              <Fragment key={colKey}>
                {colIndex > 0 && <PanelResizeHandle className="splitter-v" />}
                <ResizablePanel
                  id={colKey}
                  minSize={colMinSize}
                  maxSize={colMaxSize}
                  className="h-full"
                >
                  {isStack ? (
                    <StackedColumn
                      topId={slot[0]}
                      bottomId={slot[1]}
                      splitHeights={splitHeights}
                      onSplitChange={(key, val) => setSplitHeights(prev => ({ ...prev, [key]: val }))}
                      editMode={editMode}
                      draggedPanel={draggedPanel}
                      dragOverPanel={dragOverPanel}
                      setDraggedPanel={setDraggedPanel}
                      setDragOverPanel={setDragOverPanel}
                      swapPanels={swapPanels}
                      topContent={renderPanelContent(slot[0])}
                      bottomContent={renderPanelContent(slot[1])}
                    />
                  ) : (
                    <PanelWrapper
                      panelId={slot as string}
                      editMode={editMode}
                      draggedPanel={draggedPanel}
                      dragOverPanel={dragOverPanel}
                      setDraggedPanel={setDraggedPanel}
                      setDragOverPanel={setDragOverPanel}
                      swapPanels={swapPanels}
                      stackPanel={stackPanel}
                    >
                      {renderPanelContent(slot as string)}
                    </PanelWrapper>
                  )}
                </ResizablePanel>
              </Fragment>
            );
          })}
        </PanelGroup>

        {/* Edge drop zones — visible only when dragging in edit mode */}
        {editMode && draggedPanel && (
          <ColumnInsertOverlay
            visibleLayout={visibleLayout}
            draggedPanel={draggedPanel}
            onInsert={insertPanelAt}
            setDraggedPanel={setDraggedPanel}
            setDragOverPanel={setDragOverPanel}
          />
        )}
      </div>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentTheme={currentTheme} onThemeChange={setCurrentTheme}
        customNotifications={customNotifications} onCustomNotificationsChange={setCustomNotifications} defaultColor={defaultColor} onDefaultColorChange={setDefaultColor}
        highlightingEnabled={highlightingEnabled} onHighlightingEnabledChange={setHighlightingEnabled}
        highlightSoundsEnabled={highlightSoundsEnabled} onHighlightSoundsEnabledChange={setHighlightSoundsEnabled}
        keywords={keywords} onKeywordsChange={setKeywords}
        panelVisibility={panelVisibility} onTogglePanel={togglePanel} onResetLayout={resetLayout}
        panelOrder={panelOrder} onApplyPreset={applyPreset}
        showPrices={showPrices} onShowPricesChange={setShowPrices} />

      <DeploySettingsModal isOpen={isDeploySettingsOpen} onClose={() => { setIsDeploySettingsOpen(false); setSettingsVersion(v => v + 1); }} onWalletChange={setActiveWallet}
        wallets={wallets} onWalletsChange={setWallets}
        presets={customPresets} onPresetsChange={setCustomPresets} themeId={currentTheme} />

      <ImageLibraryModal
        isOpen={isImageLibraryOpen}
        onClose={() => setIsImageLibraryOpen(false)}
        onSelectImage={(imageUrl: string) => {
          setDeployedImageUrl(imageUrl);
        }}
        themeId={currentTheme}
      />

      <VampModal
        isOpen={isVampOpen}
        onClose={() => setIsVampOpen(false)}
        onResult={(data) => setVampData(data)}
      />
    </div>
  );
}
