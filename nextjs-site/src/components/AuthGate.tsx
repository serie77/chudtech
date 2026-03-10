"use client";

import { useState, useEffect, useCallback } from "react";
import { migrateToUserStorage, loadFromServer } from "@/lib/store";

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const [region, setRegion] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('chud-region') || 'eu';
    return 'eu';
  });

  useEffect(() => {
    const stored = localStorage.getItem("chud-api-key");
    if (stored) {
      // Validate stored key with server before auto-logging in
      fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: stored }),
      })
        .then(res => res.json())
        .then(async (data) => {
          if (data.valid) {
            document.cookie = `chud-api-key=${stored}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
            migrateToUserStorage();
            await loadFromServer();
            setAuthenticated(true);
          } else {
            localStorage.removeItem("chud-api-key");
          }
        })
        .catch(() => {
          // If server is unreachable, trust the stored key
          document.cookie = `chud-api-key=${stored}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
          migrateToUserStorage();
          setAuthenticated(true);
        })
        .finally(() => {
          setChecking(false);
          requestAnimationFrame(() => setMounted(true));
        });
    } else {
      setChecking(false);
      requestAnimationFrame(() => setMounted(true));
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: trimmed }),
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem("chud-api-key", trimmed);
        localStorage.setItem("chud-region", region);
        document.cookie = `chud-api-key=${trimmed}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
        migrateToUserStorage();
        await loadFromServer();
        setAuthenticated(true);
      } else {
        setError("Invalid API key");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError("Connection failed");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setSubmitting(false);
    }
  }, [apiKey]);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
      </div>
    );
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 overflow-hidden">
      {/* Subtle radial glow behind the card */}
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-[2000ms]"
        style={{
          opacity: mounted ? 1 : 0,
          background: 'radial-gradient(ellipse 600px 400px at 50% 45%, rgba(220,38,38,0.04) 0%, transparent 70%)',
        }}
      />

      <div
        className="w-full max-w-sm relative transition-all duration-700 ease-out"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12 group cursor-default">
          <div className="relative">
            <img
              src="/images/chud.jpg"
              alt=""
              className="w-11 h-11 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
              style={{ boxShadow: '0 0 20px rgba(220,38,38,0.15)' }}
            />
          </div>
          <span className="text-[24px] font-semibold tracking-tight select-none">
            <span className="text-red-500 transition-all duration-300 group-hover:text-red-400" style={{ textShadow: '0 0 30px rgba(220,38,38,0.3)' }}>chud</span>
            <span className="text-white/90 transition-colors duration-300 group-hover:text-white">.tech</span>
          </span>
        </div>

        {/* Region Selector */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          <button
            type="button"
            onClick={() => setRegion('eu')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
              region === 'eu'
                ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                : 'text-white/25 hover:text-white/50 border border-transparent'
            }`}
          >
            EU
          </button>
          <span className="text-white/[0.08] text-[10px]">|</span>
          <button
            type="button"
            onClick={() => setRegion('na')}
            className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all duration-200 ${
              region === 'na'
                ? 'bg-white/[0.08] text-white border border-white/[0.12]'
                : 'text-white/25 hover:text-white/50 border border-transparent'
            }`}
          >
            NA
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div
            className={`relative transition-all duration-300 ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
          >
            <div
              className={`absolute -inset-[1px] rounded-lg transition-opacity duration-300 ${focused ? 'opacity-100' : 'opacity-0'}`}
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.2), rgba(255,255,255,0.05))' }}
            />
            <input
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(""); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
              className="relative w-full bg-white/[0.04] text-white text-[13px] px-4 py-3.5 rounded-lg border border-white/[0.08] focus:outline-none focus:border-red-500/30 placeholder-white/20 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.05]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !apiKey.trim()}
            className="relative w-full py-3.5 rounded-lg text-[13px] font-medium overflow-hidden transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed bg-white/[0.05] hover:bg-red-500/10 text-white/70 hover:text-white border border-white/[0.06] hover:border-red-500/30 active:scale-[0.98]"
          >
            {/* Sheen effect on hover */}
            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500" style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)' }} />
            <span className="relative">
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto" />
              ) : (
                "Continue"
              )}
            </span>
          </button>

          <div className="h-5 flex items-center justify-center">
            {error && (
              <p className="text-[11px] text-red-400/70 text-center animate-[fadeIn_0.2s_ease-out]">{error}</p>
            )}
          </div>
        </form>

        <p
          className="text-[10px] text-white/[0.06] text-center mt-6 transition-colors duration-500 hover:text-white/15 select-none"
        >
          Authorized access only
        </p>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(5px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(3px); }
          75% { transform: translateX(-2px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
