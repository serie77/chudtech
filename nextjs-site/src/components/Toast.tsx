"use client";

import { useEffect, useState, useRef } from "react";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
  duration?: number;
}

const configs = {
  success: {
    bg: "rgba(16, 16, 27, 0.85)",
    border: "rgba(34, 211, 238, 0.25)",
    glow: "0 4px 24px rgba(34, 211, 238, 0.12), 0 0 0 1px rgba(34, 211, 238, 0.06)",
    color: "#22d3ee",
    path: "M5 13l4 4L19 7",
  },
  error: {
    bg: "rgba(16, 16, 27, 0.85)",
    border: "rgba(248, 113, 113, 0.25)",
    glow: "0 4px 24px rgba(239, 68, 68, 0.12), 0 0 0 1px rgba(239, 68, 68, 0.06)",
    color: "#f87171",
    path: "M6 18L18 6M6 6l12 12",
  },
  info: {
    bg: "rgba(16, 16, 27, 0.85)",
    border: "rgba(96, 165, 250, 0.25)",
    glow: "0 4px 24px rgba(59, 130, 246, 0.12), 0 0 0 1px rgba(59, 130, 246, 0.06)",
    color: "#60a5fa",
    path: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export default function Toast({ message, type, onClose, duration = 4000 }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setIsExiting(true), duration - 300);
    const removeTimer = setTimeout(onClose, duration);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onClose]);

  // Slide down from top on mount
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(-12px) scale(0.95)";
    requestAnimationFrame(() => {
      el.style.transition = "opacity 0.25s cubic-bezier(0.16,1,0.3,1), transform 0.25s cubic-bezier(0.16,1,0.3,1)";
      el.style.opacity = "1";
      el.style.transform = "translateY(0) scale(1)";
    });
  }, []);

  // Slide up + fade on exit
  useEffect(() => {
    const el = ref.current;
    if (!el || !isExiting) return;
    el.style.transition = "opacity 0.2s ease-in, transform 0.2s ease-in";
    el.style.opacity = "0";
    el.style.transform = "translateY(-8px) scale(0.97)";
  }, [isExiting]);

  const c = configs[type];

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        borderRadius: "8px",
        maxWidth: "380px",
        background: c.bg,
        border: `1px solid ${c.border}`,
        boxShadow: c.glow,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <svg
        width="13"
        height="13"
        fill="none"
        stroke={c.color}
        viewBox="0 0 24 24"
        style={{ flexShrink: 0 }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={c.path} />
      </svg>
      <span
        style={{
          flex: 1,
          fontSize: "11px",
          fontWeight: 600,
          lineHeight: 1.3,
          color: c.color,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {message}
      </span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onClose, 200);
        }}
        style={{
          flexShrink: 0,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          opacity: 0.3,
          color: c.color,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.opacity = "0.8"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.opacity = "0.3"; }}
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
