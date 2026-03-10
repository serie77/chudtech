"use client";

import { useState, useRef, useCallback } from "react";
import { Sparkles, Loader2, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { getTheme } from "@/utils/themes";
import { storeGet } from "@/lib/store";

interface CanvasProps {
  themeId: string;
  onImageSelected: (imageUrl: string) => void;
}

export default function Canvas({ themeId, onImageSelected }: CanvasProps) {
  const theme = getTheme(themeId);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getApiKey = () => {
    if (typeof window === 'undefined') return '';
    return storeGet('nnn-gemini-key') || '';
  };

  const handleGenerate = useCallback(async () => {
    const apiKey = getApiKey();
    if (!apiKey) {
      setError("Set your Gemini API key in Settings → Advanced");
      return;
    }
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/gemini-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), apiKey }),
      });

      const data = await res.json();

      if (!res.ok || !data.image) {
        setError(data.error || 'Failed to generate image');
        return;
      }

      setGeneratedImages(prev => [data.image, ...prev]);
      setSelectedIdx(0);
    } catch {
      setError('Network error');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setGeneratedImages(prev => [dataUrl, ...prev]);
      setSelectedIdx(0);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleUseImage = useCallback((idx: number) => {
    const img = generatedImages[idx];
    if (img) {
      onImageSelected(img);
      setSelectedIdx(idx);
    }
  }, [generatedImages, onImageSelected]);

  const handleClear = useCallback(() => {
    setGeneratedImages([]);
    setSelectedIdx(null);
    setPrompt("");
    setError(null);
  }, []);

  const handleRemoveImage = useCallback((idx: number) => {
    setGeneratedImages(prev => prev.filter((_, i) => i !== idx));
    if (selectedIdx === idx) setSelectedIdx(null);
    else if (selectedIdx !== null && selectedIdx > idx) setSelectedIdx(selectedIdx - 1);
  }, [selectedIdx]);

  return (
    <div className={`h-full ${theme.panel1ContentBg} glass-panel flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span className="section-label">Canvas</span>
        {generatedImages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-white/20 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10 text-[10px] transition-colors"
          >
            <Trash2 size={10} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2 flex flex-col gap-2">
        {/* Prompt input */}
        <div className="flex flex-col gap-1.5">
          <textarea
            placeholder="Describe what to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            rows={3}
            className={`w-full ${theme.inputBg} text-white text-[12px] px-2.5 py-2 rounded-md border ${theme.inputBorder} focus:outline-none resize-none input-premium`}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-white/40 hover:text-white/70 border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <Upload size={10} />
              <span>Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="hidden"
            />

            <div className="flex-1" />

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-semibold bg-blue-600/80 hover:bg-blue-500/80 disabled:opacity-30 disabled:hover:bg-blue-600/80 text-white transition-colors"
            >
              {isGenerating ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Sparkles size={10} />
              )}
              <span>{isGenerating ? 'Generating...' : 'Generate'}</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-[10px] text-red-400/80 px-1">{error}</div>
        )}

        {/* Generated images grid */}
        {generatedImages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {generatedImages.map((img, idx) => (
              <div
                key={idx}
                className={`relative group cursor-pointer rounded-md overflow-hidden border transition-all ${
                  selectedIdx === idx
                    ? 'ring-2 ring-green-500 border-green-500'
                    : 'border-white/[0.06] hover:border-white/20'
                }`}
                style={{ width: 72, height: 72 }}
                onClick={() => handleUseImage(idx)}
              >
                <img
                  src={img}
                  alt={`Generated ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {selectedIdx === idx && (
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {/* Remove button on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                  className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/60 rounded-full items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex"
                >
                  <Trash2 size={8} className="text-white/70" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {generatedImages.length === 0 && !isGenerating && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
            <ImageIcon size={24} className="text-white/10 mb-2" />
            <p className="text-[10px] text-white/20">Describe an image and hit Generate</p>
            <p className="text-[10px] text-white/12 mt-0.5">or upload your own</p>
          </div>
        )}

        {/* Loading state */}
        {isGenerating && generatedImages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <Loader2 size={20} className="text-blue-400/50 animate-spin mb-2" />
            <p className="text-[10px] text-white/25">Generating image...</p>
          </div>
        )}
      </div>
    </div>
  );
}
