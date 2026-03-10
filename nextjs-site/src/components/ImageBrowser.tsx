"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Image as ImageIcon, RefreshCw, Check, X, Search, Upload, Trash2 } from "lucide-react";
import { getTheme } from "@/utils/themes";

export interface ImageFile {
  name: string;
  nameWithoutExt: string;
  filename: string;
  size: number;
  modifiedAt?: string;
  extension?: string;
}

interface ImageBrowserProps {
  themeId: string;
  filterText: string;
  onImageSelected: (imageUrl: string) => void;
  selectedImagePath: string | null;
  onImagesLoaded?: (images: ImageFile[]) => void;
}

export default function ImageBrowser({ themeId, filterText, onImageSelected, selectedImagePath, onImagesLoaded }: ImageBrowserProps) {
  const theme = getTheme(themeId);
  const [allImages, setAllImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync search query when filterText changes from Panel1 name
  useEffect(() => {
    setSearchQuery(filterText);
  }, [filterText]);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/local-images');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setAllImages(data.images);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load images";
      setError(message);
      setAllImages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // Notify parent whenever images change
  const onImagesLoadedRef = useRef(onImagesLoaded);
  onImagesLoadedRef.current = onImagesLoaded;
  useEffect(() => {
    if (allImages.length > 0) {
      onImagesLoadedRef.current?.(allImages);
    }
  }, [allImages]);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return allImages;
    const lower = searchQuery.toLowerCase();
    return allImages.filter(img => img.nameWithoutExt.toLowerCase().includes(lower));
  }, [allImages, searchQuery]);

  const handleImageClick = (image: ImageFile) => {
    const serveUrl = `/api/local-images/serve?file=${encodeURIComponent(image.filename)}`;
    onImageSelected(serveUrl);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-image', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
      }
      // Refresh the list after upload
      await fetchImages();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent, image: ImageFile) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/upload-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: image.filename }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setAllImages(prev => prev.filter(i => i.filename !== image.filename));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div
      className={`h-full ${theme.panel1ContentBg} glass-panel flex flex-col overflow-hidden`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-label">Images</span>
          {allImages.length > 0 && (
            <span className="text-[10px] text-white/25 font-medium">
              {searchQuery.trim() ? `${filteredImages.length}/${allImages.length}` : allImages.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-icon"
            title="Upload image"
            disabled={isUploading}
          >
            <Upload size={11} className={isUploading ? "animate-pulse" : ""} />
          </button>
          <button
            onClick={fetchImages}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Search / Filter */}
      <div className="px-2.5 pb-1.5 pt-1">
        <div className="relative">
          <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/15" />
          <input
            type="text"
            placeholder="Filter images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] text-white text-[11px] pl-6 pr-6 py-1.5 rounded-md border border-white/[0.06] focus:outline-none min-w-0 input-premium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/20 hover:text-white/50 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Image Grid */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading && allImages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={16} className="text-white/20 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <div className="w-10 h-10 rounded-lg bg-red-500/5 border border-red-500/10 flex items-center justify-center">
              <X size={16} className="text-red-400/40" />
            </div>
            <span className="text-[11px] text-red-400/50 block text-center">{error}</span>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
              {allImages.length === 0 ? <Upload size={16} className="text-white/15" /> : <ImageIcon size={16} className="text-white/15" />}
            </div>
            <span className="text-[11px] text-white/20 text-center">
              {searchQuery ? `No images match "${searchQuery}"` : "No images yet. Upload or drag & drop images here."}
            </span>
            {allImages.length === 0 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[10px] text-white/40 hover:text-white/70 underline underline-offset-2"
              >
                Upload images
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))" }}>
            {filteredImages.map((image) => {
              const serveUrl = `/api/local-images/serve?file=${encodeURIComponent(image.filename)}`;
              const isSelected = selectedImagePath === serveUrl;
              return (
                <div
                  key={image.filename}
                  onClick={() => handleImageClick(image)}
                  className={`cursor-pointer rounded overflow-hidden border transition-all group relative ${
                    isSelected
                      ? "border-blue-500 ring-1 ring-blue-500/40"
                      : "border-white/[0.04] hover:border-white/[0.12]"
                  }`}
                  title={`${image.name} (${formatSize(image.size)})`}
                >
                  <div className="aspect-square bg-white/[0.02] overflow-hidden">
                    <img
                      src={serveUrl}
                      alt={image.nameWithoutExt}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23374151" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="30" text-anchor="middle" dominant-baseline="middle" fill="%236B7280"%3E%3F%3C/text%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-0.5">
                    <span className="text-[8px] text-white/50 truncate block leading-tight">
                      {image.nameWithoutExt}
                    </span>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={(e) => handleDelete(e, image)}
                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                    title="Delete"
                  >
                    <Trash2 size={8} />
                  </button>
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                      <Check size={8} className="text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
