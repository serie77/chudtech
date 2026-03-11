"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminPage() {
  const params = useSearchParams();
  const key = params.get("key") || "";
  const [authed, setAuthed] = useState(false);
  const [cookie, setCookie] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!key) return;
    fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAuthed(true);
      });
  }, [key]);

  useEffect(() => {
    if (!authed) return;
    fetch("/api/axiom-cookie")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured));
  }, [authed]);

  if (!authed) {
    return (
      <div style={{ padding: 40, color: "#666", fontFamily: "monospace" }}>
        Not authorized. Add ?key=YOUR_API_KEY to the URL.
      </div>
    );
  }

  const handleSet = async () => {
    const trimmed = cookie.trim();
    if (!trimmed) return;
    const res = await fetch("/api/axiom-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookie: trimmed }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus("Cookie set successfully");
      setConfigured(true);
      setCookie("");
    } else {
      setStatus("Failed: " + (data.error || "unknown error"));
    }
  };

  const handleClear = async () => {
    await fetch("/api/axiom-cookie", { method: "DELETE" });
    setStatus("Cookie cleared");
    setConfigured(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a1a",
        color: "#fff",
        fontFamily: "monospace",
        padding: 40,
        maxWidth: 600,
      }}
    >
      <h1 style={{ fontSize: 16, marginBottom: 24 }}>Admin</h1>

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
          Axiom Cookie:{" "}
          <span style={{ color: configured ? "#22d3ee" : "#f87171" }}>
            {configured === null ? "checking..." : configured ? "configured" : "not set"}
          </span>
        </div>

        <textarea
          value={cookie}
          onChange={(e) => setCookie(e.target.value)}
          placeholder="Paste refresh token here..."
          style={{
            width: "100%",
            height: 80,
            background: "#111",
            border: "1px solid #333",
            color: "#fff",
            padding: 10,
            fontSize: 12,
            borderRadius: 6,
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={handleSet}
            style={{
              padding: "6px 16px",
              background: "#22d3ee",
              color: "#000",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Set Cookie
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: "6px 16px",
              background: "#333",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>

        {status && (
          <div style={{ fontSize: 11, color: "#22d3ee", marginTop: 8 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
