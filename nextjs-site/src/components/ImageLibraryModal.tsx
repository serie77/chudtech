"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Search, Image as ImageIcon, Filter, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getTheme } from "@/utils/themes";
import { storeGet, storeSet } from "@/lib/store";

interface SavedImage {
  id: string;
  name: string;
  url: string;
  group: string;
  createdAt: string;
}

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string) => void;
  themeId?: string;
}

export default function ImageLibraryModal({ isOpen, onClose, onSelectImage, themeId = "default" }: ImageLibraryModalProps) {
  const theme = getTheme(themeId);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [groups, setGroups] = useState<string[]>(["Default"]);
  const [filterText, setFilterText] = useState("");
  const [showAddImageModal, setShowAddImageModal] = useState(false);

  // Google search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ imageUrl: string; thumbnailUrl?: string; title?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch external image through proxy and convert to data URL
  const selectGoogleImage = async (url: string, index: number) => {
    setLoadingIndex(index);
    try {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const blob = await res.blob();
      if (blob.size < 100 || !blob.type.startsWith('image')) {
        onSelectImage(url);
        onClose();
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onSelectImage(reader.result as string);
        onClose();
      };
      reader.readAsDataURL(blob);
    } catch {
      onSelectImage(url);
      onClose();
    }
  };

  const handleGoogleSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      const imgs = data.images || data.results || (Array.isArray(data) ? data : []);
      if (Array.isArray(imgs) && imgs.length > 0) {
        setSearchResults(
          imgs.map((r: any) => ({
            imageUrl: r.imageUrl || r.url || r.image || (typeof r === 'string' ? r : ''),
            thumbnailUrl: r.thumbnailUrl || r.thumbnail,
            title: r.title,
          })).filter((r: any) => r.imageUrl)
        );
      } else {
        setSearchResults([]);
        setSearchError("No results found");
      }
    } catch {
      setSearchError("Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Load images and groups from localStorage
  useEffect(() => {
    if (isOpen) {
      const savedImages = storeGet('image-library');
      const savedGroups = storeGet('image-library-groups');

      if (savedImages) {
        try {
          setImages(JSON.parse(savedImages));
        } catch (error) {
          console.error('Failed to load images:', error);
        }
      }

      if (savedGroups) {
        try {
          setGroups(JSON.parse(savedGroups));
        } catch (error) {
          console.error('Failed to load groups:', error);
        }
      }
    }
  }, [isOpen]);

  const filteredImages = images.filter(img =>
    img.name.toLowerCase().includes(filterText.toLowerCase()) ||
    img.group.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={`w-[800px] max-w-[800px] h-[600px] p-0 flex flex-col z-[100] ${theme.panel1ContentBg} border-white/[0.08]`}>
          <DialogHeader>
            <DialogTitle>Images</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="your-images" className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="your-images">
                <ImageIcon size={14} />
                Your Images
              </TabsTrigger>
              <TabsTrigger value="search-google" onMouseDown={() => {
                setTimeout(() => searchInputRef.current?.focus(), 0);
              }}>
                <Search size={14} />
                Search Google
              </TabsTrigger>
            </TabsList>

            {/* Your Images Tab */}
            <TabsContent value="your-images" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <div className="flex-1 flex items-center gap-2 bg-white/[0.04] rounded-md px-3 py-1.5 border border-white/[0.08]">
                  <Filter size={12} className="text-white/25" />
                  <Input
                    type="text"
                    placeholder="Filter images..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="flex-1 border-0 bg-transparent p-0 h-auto focus:border-0 placeholder-white/20 text-[12px]"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddImageModal(true)}
                  className="bg-blue-600/80 hover:bg-blue-500/80 text-white text-[11px]"
                >
                  <Plus size={12} />
                  Add Image
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {filteredImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <ImageIcon size={40} className="mb-2 text-white/10" />
                    <p className="text-[12px] text-white/25">No saved images yet</p>
                    <p className="text-[10px] text-white/15 mt-1">Click &quot;Add Image&quot; to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2.5">
                    {filteredImages.map((img) => (
                      <div
                        key={img.id}
                        onClick={() => {
                          onSelectImage(img.url);
                          onClose();
                        }}
                        className="group cursor-pointer rounded-lg overflow-hidden border border-white/[0.06] hover:border-blue-500/50 transition-all bg-white/[0.02]"
                      >
                        <div className="aspect-square bg-black/20 flex items-center justify-center overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-white/80 truncate">{img.name}</p>
                          <p className="text-[10px] text-white/30 truncate">{img.group}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Search Google Tab */}
            <TabsContent value="search-google" className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleGoogleSearch(searchQuery); }}
                  className="flex-1 flex items-center gap-2"
                >
                  <div className="flex-1 flex items-center gap-2 bg-white/[0.04] rounded-md px-3 py-1.5 border border-white/[0.08]">
                    <Search size={12} className="text-white/25" />
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search Google Images..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1 border-0 bg-transparent p-0 h-auto focus:border-0 placeholder-white/20 text-[12px]"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSearching || !searchQuery.trim()}
                    className="bg-blue-600/80 hover:bg-blue-500/80 text-white text-[11px] disabled:opacity-30"
                  >
                    {isSearching ? <Loader2 size={12} className="animate-spin" /> : "Search"}
                  </Button>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {isSearching ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="text-white/20 animate-spin" />
                  </div>
                ) : searchError ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[12px] text-white/30">{searchError}</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {searchResults.map((result, i) => (
                      <div
                        key={`${result.imageUrl}-${i}`}
                        onClick={() => selectGoogleImage(result.imageUrl, i)}
                        className={`group cursor-pointer rounded-lg overflow-hidden border transition-all bg-white/[0.02] ${
                          loadingIndex === i ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-white/[0.06] hover:border-blue-500/50'
                        }`}
                        title={result.title}
                      >
                        <div className="aspect-square bg-black/20 flex items-center justify-center overflow-hidden relative">
                          <img
                            src={result.thumbnailUrl || result.imageUrl}
                            alt={result.title || `Result ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                          />
                          {loadingIndex === i && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Loader2 size={16} className="text-white animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <Search size={32} className="mb-2 text-white/10" />
                    <p className="text-[12px] text-white/25">Search for images</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Add Image Modal */}
      <AddImageModal
        isOpen={showAddImageModal}
        groups={groups}
        onClose={() => setShowAddImageModal(false)}
        onSave={(newImage) => {
          const updatedImages = [...images, newImage];
          setImages(updatedImages);
          storeSet('image-library', JSON.stringify(updatedImages));
          setShowAddImageModal(false);
        }}
        onCreateGroup={(newGroup) => {
          const updatedGroups = [...groups, newGroup];
          setGroups(updatedGroups);
          storeSet('image-library-groups', JSON.stringify(updatedGroups));
        }}
        themeId={themeId}
      />
    </>
  );
}

interface AddImageModalProps {
  isOpen: boolean;
  groups: string[];
  onClose: () => void;
  onSave: (image: SavedImage) => void;
  onCreateGroup: (group: string) => void;
  themeId?: string;
}

function AddImageModal({ isOpen, groups, onClose, onSave, onCreateGroup, themeId = "default" }: AddImageModalProps) {
  const theme = getTheme(themeId);
  const [imageName, setImageName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(groups[0] || "Default");
  const [imageUrl, setImageUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showGroupInput, setShowGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImageUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImageUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSave = () => {
    if (!imageUrl || !imageName.trim()) return;

    const newImage: SavedImage = {
      id: Date.now().toString(),
      name: imageName.trim(),
      url: imageUrl,
      group: selectedGroup,
      createdAt: new Date().toISOString(),
    };

    onSave(newImage);
  };

  const handleCreateGroup = () => {
    if (newGroupName.trim() && !groups.includes(newGroupName.trim())) {
      onCreateGroup(newGroupName.trim());
      setSelectedGroup(newGroupName.trim());
      setNewGroupName("");
      setShowGroupInput(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`w-[500px] max-w-[500px] z-[110] ${theme.panel1ContentBg} border-white/[0.08]`}>
        <DialogHeader>
          <DialogTitle>Add Image</DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={handleDrop}
            onClick={() => document.getElementById('image-file-input')?.click()}
            className={`border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
              isDragging
                ? 'border-blue-500/60 bg-blue-500/10'
                : 'border-white/[0.1] hover:border-white/20 bg-white/[0.02]'
            }`}
          >
            {imageUrl ? (
              <img src={imageUrl} alt="Preview" className="w-full h-48 object-contain" />
            ) : (
              <div className="flex flex-col items-center">
                <ImageIcon size={32} className="mb-2 text-white/15" />
                <p className="text-[12px] text-white/30">Click or drag image</p>
              </div>
            )}
            <input
              id="image-file-input"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Image Name */}
          <Input
            type="text"
            placeholder="Image name (for searching)"
            value={imageName}
            onChange={(e) => setImageName(e.target.value)}
            className="input-premium text-[12px]"
          />

          {/* Group Selection */}
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">Group</label>
            {showGroupInput ? (
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="New group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateGroup();
                    if (e.key === 'Escape') setShowGroupInput(false);
                  }}
                  className="flex-1 input-premium text-[12px]"
                  autoFocus
                />
                <Button size="sm" onClick={handleCreateGroup} className="bg-blue-600/80 hover:bg-blue-500/80 text-white text-[11px]">
                  Create
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowGroupInput(false)} className="text-white/40 text-[11px]">
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="flex-1 bg-white/[0.05] text-white/80 px-3 py-1.5 rounded-md border border-white/[0.08] text-[12px] focus:outline-none focus:border-blue-500/40"
                >
                  {groups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" size="sm" onClick={() => setShowGroupInput(true)} className="text-white/40 hover:text-white/60 text-[11px] border border-white/[0.06]">
                  <Plus size={12} />
                  New Group
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.06]">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-white/40 text-[11px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!imageUrl || !imageName.trim()}
            className="bg-blue-600/80 hover:bg-blue-500/80 text-white text-[11px] disabled:opacity-30"
          >
            Save Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
