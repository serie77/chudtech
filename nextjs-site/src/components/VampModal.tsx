"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface VampData {
  tokenName: string;
  tokenSymbol: string;
  tokenImage: string;
  website: string;
  twitter: string;
  platform?: string;
}

interface VampModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: VampData) => void;
}

export default function VampModal({ isOpen, onClose, onResult }: VampModalProps) {
  const [ca, setCa] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Auto-paste from clipboard on open
  useEffect(() => {
    if (isOpen) {
      navigator.clipboard.readText().then((text) => {
        const trimmed = text.trim();
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
          setCa(trimmed);
          doFetch(trimmed);
        }
      }).catch(() => {});
    }
    return () => {
      setCa("");
      setError(null);
    };
  }, [isOpen]);

  const doFetch = async (address: string) => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vamp-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress: address.trim() }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        onResult(json.data);
        onClose();
      } else {
        setError(json.error || "Token not found");
      }
    } catch {
      setError("Failed to fetch token data");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doFetch(ca);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[420px] max-w-[420px] p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[13px]">
            <Zap size={13} className="text-yellow-400" />
            Vamp
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-4 pb-4 pt-3">
          <label className="text-[11px] text-white/40 mb-1.5 block">Contract Address</label>
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Paste CA..."
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              className="flex-1 text-[11px] h-8 bg-white/[0.03] border-white/[0.06] placeholder-white/20 font-mono"
            />
            <Button
              type="submit"
              disabled={loading || !ca.trim()}
              size="sm"
              className="h-8 px-4 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 text-[11px] font-medium"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : "Fetch"}
            </Button>
          </div>
          {error && (
            <p className="text-[10px] text-red-400/80 mt-2">{error}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
