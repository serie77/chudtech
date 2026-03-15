"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Search, Loader2, AlertCircle, X } from "lucide-react";
import { getTheme } from "@/utils/themes";

export interface TokenResult {
  address: string;
  name: string;
  symbol: string;
  imageUrl?: string;
  marketCapSol?: number;
  protocol?: string;
  createdAt?: string;
}

interface TokenSearchProps {
  themeId: string;
  onTokenSelected: (token: TokenResult) => void;
  onImageOnly: (imageUrl: string) => void;
  onSearchImages?: (imageUrls: string[]) => void;
  externalQuery?: string;
  variant?: 'default' | 'launchblitz';
}

const PROTOCOL_COLORS: Record<string, string> = {
  Pump: "#a3e635",
  Ray: "#6366f1",
  Bonk: "#f97316",
  Orca: "#06b6d4",
  Met: "#ec4899",
};

function protocolLabel(p: string | undefined | null): string {
  if (!p) return "";
  if (p.includes("Pump")) return "Pump";
  if (p.includes("Raydium")) return "Ray";
  if (p.includes("Bonk")) return "Bonk";
  if (p.includes("Orca")) return "Orca";
  if (p.includes("Meteora")) return "Met";
  return p.slice(0, 4);
}

function formatMcap(n: number | undefined | null): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  if (n > 0) return `$${n.toFixed(1)}`;
  return "$0";
}

function extractMcap(item: any): number | null {
  return item.marketCapSol ?? item.mcapSol ?? item.mcap ?? item.marketCap
    ?? item.marketCapUsd ?? item.mcapUsd ?? item.usdMarketCap
    ?? item.market_cap ?? item.fdv ?? null;
}

export default function TokenSearch({ themeId, onTokenSelected, onImageOnly, onSearchImages, externalQuery, variant = 'default' }: TokenSearchProps) {
  const theme = getTheme(themeId);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const lastQueryRef = useRef("");
  const searchIdRef = useRef(0);
  const prevExternalQueryRef = useRef(externalQuery);
  const abortRef = useRef<AbortController | null>(null);

  const onSearchImagesRef = useRef(onSearchImages);
  onSearchImagesRef.current = onSearchImages;

  // Client-side Axiom access token — fetched once, auto-refreshes when expired
  const axiomTokenRef = useRef<{ token: string; expiresAt: number } | null>(null);

  const getAxiomToken = useCallback(async (): Promise<string | null> => {
    const cached = axiomTokenRef.current;
    if (cached && Date.now() < cached.expiresAt) return cached.token;

    try {
      const res = await fetch('/api/axiom-token');
      const data = await res.json();
      if (data.accessToken) {
        axiomTokenRef.current = { token: data.accessToken, expiresAt: data.expiresAt || Date.now() + 14 * 60 * 1000 };
        return data.accessToken;
      }
    } catch {}
    return null;
  }, []);

  const normalizeResults = (data: any): TokenResult[] => {
    let items: any[] = [];
    if (Array.isArray(data)) items = data;
    else if (data.results && Array.isArray(data.results)) items = data.results;
    else if (data.tokens && Array.isArray(data.tokens)) items = data.tokens;
    else if (data.data && Array.isArray(data.data)) items = data.data;

    return items.slice(0, 30).map((item: any) => ({
      address: item.tokenAddress || item.address || item.mint || "",
      name: item.tokenName || item.name || "Unknown",
      symbol: item.tokenTicker || item.symbol || item.ticker || "???",
      imageUrl: item.tokenImage || item.imageUrl || item.image || item.logo || undefined,
      marketCapSol: extractMcap(item) ?? undefined,
      protocol: item.protocol || undefined,
      createdAt: item.createdAt || undefined,
    }));
  };

  // Direct client-side Axiom search — no server proxy, zero extra hops
  const doSearch = useCallback(async (searchQuery: string, force = false) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (!force && trimmed === lastQueryRef.current) return;
    lastQueryRef.current = trimmed;

    // Cancel any in-flight search
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const searchId = ++searchIdRef.current;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const accessToken = await getAxiomToken();
      if (!accessToken) {
        // Fallback to server proxy if no token
        const res = await fetch(`/api/token-search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const data = await res.json();
        if (searchId !== searchIdRef.current) return;
        if (data.error) { setError(data.error); setResults([]); }
        else {
          const normalized = normalizeResults(data);
          setResults(normalized);
          if (normalized.length === 0) setError("No tokens found");
          else { const imgs = normalized.map(t => t.imageUrl).filter(Boolean) as string[]; if (imgs.length) onSearchImagesRef.current?.(imgs); }
        }
        return;
      }

      const url = new URL('https://api3.axiom.trade/search-v3');
      url.searchParams.set('searchQuery', trimmed);
      url.searchParams.set('isOg', 'false');
      url.searchParams.set('isPumpSearch', 'false');
      url.searchParams.set('isBonkSearch', 'false');
      url.searchParams.set('isBagsSearch', 'false');
      url.searchParams.set('isUsd1Search', 'false');
      url.searchParams.set('onlyBonded', 'false');

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (searchId !== searchIdRef.current) return;

      if (!res.ok) {
        // Token might be expired — clear cache and fallback
        axiomTokenRef.current = null;
        const fallback = await fetch(`/api/token-search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const data = await fallback.json();
        if (searchId !== searchIdRef.current) return;
        if (data.error) { setError(data.error); setResults([]); }
        else {
          const normalized = normalizeResults(data);
          setResults(normalized);
          if (normalized.length === 0) setError("No tokens found");
          else { const imgs = normalized.map(t => t.imageUrl).filter(Boolean) as string[]; if (imgs.length) onSearchImagesRef.current?.(imgs); }
        }
        return;
      }

      const data = await res.json();
      const normalized = normalizeResults(data);
      setResults(normalized);
      if (normalized.length === 0) {
        setError("No tokens found");
      } else {
        const imgs = normalized.map(t => t.imageUrl).filter(Boolean) as string[];
        if (imgs.length) onSearchImagesRef.current?.(imgs);
      }
    } catch (err: any) {
      if (searchId !== searchIdRef.current) return;
      if (err?.name === 'AbortError') return;
      setError("Search failed");
      setResults([]);
    } finally {
      if (searchId === searchIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [getAxiomToken]);

  // Pre-fetch Axiom access token on mount so first search is instant
  useEffect(() => { getAxiomToken(); }, [getAxiomToken]);

  // Handle external search query
  useEffect(() => {
    if (externalQuery !== prevExternalQueryRef.current) {
      if (externalQuery && externalQuery.trim().length >= 2) {
        setQuery(externalQuery);
        doSearch(externalQuery, true);
      } else if (externalQuery !== undefined && externalQuery.trim() === "") {
        setQuery("");
        setResults([]);
        setHasSearched(false);
        setError(null);
        lastQueryRef.current = "";
      }
    }
    prevExternalQueryRef.current = externalQuery;
  }, [externalQuery, doSearch]);

  // Safety: clear stale loading state after 12s
  useEffect(() => {
    if (!isSearching) return;
    const safety = setTimeout(() => setIsSearching(false), 12000);
    return () => clearTimeout(safety);
  }, [isSearching]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, true);
  };

  // Shared search input handler — fires instantly, no debounce
  const handleQueryChange = (val: string) => {
    setQuery(val);
    const trimmed = val.trim();
    if (trimmed.length >= 2) {
      doSearch(trimmed);
    } else if (trimmed.length === 0) {
      setResults([]);
      setHasSearched(false);
      setError(null);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setError(null);
    lastQueryRef.current = "";
  };

  // ─── Launchblitz variant ───
  if (variant === 'launchblitz') {
    const LB_PLATFORMS = [
      { id: 'pump', label: 'Pump', icon: '/images/pump-green.svg', borderColor: '#1f5a3b', bgColor: '#10241a', hoverColor: '#1c3a2b' },
      { id: 'bonk', label: 'Bonk', icon: '/images/bonk.png', borderColor: undefined, bgColor: undefined, hoverColor: undefined },
      { id: 'usd1', label: 'USD1', icon: '/images/usd1.png', borderColor: undefined, bgColor: undefined, hoverColor: undefined },
      { id: 'bags', label: 'Bags', icon: '/images/bags.png', borderColor: undefined, bgColor: undefined, hoverColor: undefined },
    ];

    return (
      <div data-panel-search className="h-full flex flex-col bg-[#0a0a0b] px-4 py-3">
        {/* Platform filter pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {LB_PLATFORMS.map(p => (
            <button
              key={p.id}
              className="h-6 px-2.5 flex items-center gap-1.5 rounded-[5px] border text-[10px] font-semibold transition-colors border-white/[0.10] text-white/50 hover:text-white hover:bg-white/[0.06]"
            >
              <img alt={p.label} className="w-3.5 h-3.5 rounded" src={p.icon} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="w-full flex items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              placeholder="Search or input a contract address."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full h-9 bg-black/60 text-white text-sm px-3 py-1 rounded border border-white/[0.10] focus:outline-none focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15 placeholder-white/30"
            />
            {query && (
              <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-30"
          >
            {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </form>

        {/* Results */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {!hasSearched ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Search size={18} className="text-white/10" />
              <span className="text-xs text-white/20 text-center">Search by name, ticker, or contract address</span>
            </div>
          ) : isSearching ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={20} className="text-white/20 animate-spin" />
            </div>
          ) : error && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <AlertCircle size={16} className="text-red-400/40" />
              <span className="text-xs text-red-400/50 text-center">{error}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-xs text-white/40 mb-2">Found {results.length} results</div>
              {results.map((token, i) => (
                <div
                  key={`${token.address}-${i}`}
                  className="border border-white/[0.10] rounded-lg p-3 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
                  onClick={() => onTokenSelected(token)}
                >
                  <div className="flex items-center gap-3">
                    {/* Token image */}
                    <div
                      className="w-16 h-16 shrink-0 rounded overflow-hidden bg-white/[0.03] cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); if (token.imageUrl) onImageOnly(token.imageUrl); }}
                    >
                      {token.imageUrl ? (
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(token.imageUrl)}`}
                          alt=""
                          className="w-16 h-16 rounded object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-sm font-bold text-white/10">{token.symbol.slice(0, 2)}</span>
                        </div>
                      )}
                    </div>
                    {/* Token info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-white truncate">{token.name}</span>
                        <span className="text-xs text-white/40 truncate">({token.symbol})</span>
                      </div>
                      {/* Platform quick-launch icons */}
                      <div className="mt-1 flex items-center gap-1 ml-auto">
                        {LB_PLATFORMS.map(p => (
                          <button
                            key={p.id}
                            className="relative h-8 w-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                            title={`${p.label} quick launch`}
                            onClick={(e) => { e.stopPropagation(); onTokenSelected(token); }}
                          >
                            <img alt={p.label} className="h-4 w-4 rounded" src={p.icon} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Default (NNN) variant — unchanged ───
  return (
    <div data-panel-search className={`h-full ${theme.panel1ContentBg} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-label">Search</span>
          {hasSearched && !isSearching && results.length > 0 && (
            <span className="text-[10px] text-white/25 font-medium">{results.length}</span>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="px-2.5 py-1.5 flex-shrink-0">
        <div className="flex gap-1 items-center">
          <div className="relative flex-1">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              placeholder="Name, ticker, or CA..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full bg-white/[0.04] text-white text-[11px] pl-6 pr-6 py-1.5 rounded-md border border-white/[0.06] focus:outline-none input-premium"
            />
            {query && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/20 hover:text-white/50 transition-colors"
              >
                <X size={11} />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="btn-icon disabled:opacity-30"
          >
            {isSearching ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
          </button>
        </div>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 px-6">
            <Search size={14} className="text-white/10" />
            <span className="text-[10px] text-white/15 text-center">Search by name, ticker, or CA</span>
          </div>
        ) : isSearching ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={16} className="text-white/20 animate-spin" />
          </div>
        ) : error && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 px-6">
            <AlertCircle size={14} className="text-red-400/40" />
            <span className="text-[10px] text-red-400/50 text-center">{error}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-0.5 p-1">
            {results.map((token, i) => (
              <button
                key={`${token.address}-${i}`}
                onClick={() => onTokenSelected(token)}
                className="flex items-center gap-1.5 rounded border border-white/[0.04] hover:border-white/[0.10] bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left group px-1 py-1 overflow-hidden"
              >
                <div
                  className="w-9 h-9 rounded overflow-hidden bg-white/[0.03] flex-shrink-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (token.imageUrl) onImageOnly(token.imageUrl);
                  }}
                >
                  {token.imageUrl ? (
                    <img
                      src={`/api/proxy-image?url=${encodeURIComponent(token.imageUrl)}`}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white/10">{token.symbol.slice(0, 2)}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium text-white/70 truncate leading-tight group-hover:text-white transition-colors">{token.name}</div>
                  <div className="text-[9px] text-white/30 font-medium truncate">{token.symbol}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
