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
      <DialogContent className="w-[400px] max-w-[400px] p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-400" />
            Vamp - Token Lookup
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Paste contract address..."
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              className="flex-1 text-xs py-2 rounded-md font-mono"
            />
            <Button
              type="submit"
              disabled={loading || !ca.trim()}
              className="min-w-[52px]"
              size="default"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : "Fetch"}
            </Button>
          </div>
          {error && (
            <p className="text-[11px] text-red-400 mt-2">{error}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
