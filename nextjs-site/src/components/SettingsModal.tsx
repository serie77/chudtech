"use client";

import { X, Play, Upload, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { themes as themeDefinitions } from "@/utils/themes";
import { Keyword } from "@/utils/highlightHelper";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { storeGet, storeSet, storeRemove } from "@/lib/store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  customNotifications?: CustomNotification[];
  onCustomNotificationsChange?: (notifications: CustomNotification[]) => void;
  defaultColor?: string;
  onDefaultColorChange?: (color: string) => void;
  highlightingEnabled?: boolean;
  onHighlightingEnabledChange?: (enabled: boolean) => void;
  highlightSoundsEnabled?: boolean;
  onHighlightSoundsEnabledChange?: (enabled: boolean) => void;
  keywords?: Keyword[];
  onKeywordsChange?: (keywords: Keyword[]) => void;
  panelVisibility?: Record<string, boolean>;
  onTogglePanel?: (id: string) => void;
  onResetLayout?: () => void;
  panelOrder?: string[];
  onApplyPreset?: (preset: { layout?: Array<string | [string, string]>; order?: string[]; visibility: Record<string, boolean> }) => void;
  showPrices?: boolean;
  onShowPricesChange?: (show: boolean) => void;
}

interface CustomSound {
  id: string;
  name: string;
  file: File;
  url: string;
  size: number;
}

interface CustomNotification {
  id: string;
  username: string;
  color: string;
  sound: string;
}


export default function SettingsModal({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  customNotifications: propsCustomNotifications = [],
  onCustomNotificationsChange,
  defaultColor: propsDefaultColor = "#00FFFF",
  onDefaultColorChange,
  highlightingEnabled: propsHighlightingEnabled = false,
  onHighlightingEnabledChange,
  highlightSoundsEnabled: propsHighlightSoundsEnabled = false,
  onHighlightSoundsEnabledChange,
  keywords: propsKeywords = [],
  onKeywordsChange,
  panelVisibility = { deploy: true, search: true, images: true, ai: true, feed: true },
  onTogglePanel,
  onResetLayout,
  panelOrder = ['deploy', 'search', 'images', 'ai', 'feed'],
  onApplyPreset,
  showPrices = true,
  onShowPricesChange
}: SettingsModalProps) {
  const theme = themeDefinitions[currentTheme] || themeDefinitions["modern-dark"];
  const [cardWidth, setCardWidth] = useState(() => {
    if (typeof window !== 'undefined') return parseInt(storeGet('nnn-card-width') || '2000', 10);
    return 2000;
  });
  const [cardScale, setCardScale] = useState(() => {
    if (typeof window !== 'undefined') return parseInt(storeGet('nnn-card-scale') || '100', 10);
    return 100;
  });
  const [pauseOnHover, setPauseOnHover] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-pause-on-hover'); return v !== null ? v === 'true' : true; }
    return true;
  });
  // Theme preview data for inline grid
  const themePreviewData: Record<string, { gradient: string; dot: string; border: string }> = {
    "legacy-default": { gradient: "from-[#1a2236] to-blue-900/60", dot: "bg-blue-500", border: "border-blue-500" },
    "dark": { gradient: "from-gray-800 to-gray-950", dot: "bg-blue-500", border: "border-blue-500" },
    "modern-dark": { gradient: "from-gray-900 to-black", dot: "bg-gray-400", border: "border-gray-500" },
    "midnight-blue": { gradient: "from-slate-900 to-blue-950", dot: "bg-cyan-500", border: "border-cyan-500" },
    "dusk": { gradient: "from-stone-800 to-amber-950", dot: "bg-amber-500", border: "border-amber-600" },
    "sunset": { gradient: "from-purple-800 to-pink-900", dot: "bg-pink-500", border: "border-pink-600" },
    "purple": { gradient: "from-purple-900 to-purple-950", dot: "bg-purple-400", border: "border-purple-500" },
    "forest": { gradient: "from-green-900 to-emerald-950", dot: "bg-green-500", border: "border-green-600" },
    "crimson": { gradient: "from-red-900 to-rose-950", dot: "bg-red-500", border: "border-red-600" },
    "cyan": { gradient: "from-slate-900 to-cyan-950", dot: "bg-cyan-400", border: "border-cyan-500" },
    "gold": { gradient: "from-amber-900 to-yellow-950", dot: "bg-yellow-500", border: "border-yellow-600" },
    "orange": { gradient: "from-orange-900 to-red-950", dot: "bg-orange-500", border: "border-orange-600" },
    "pink": { gradient: "from-pink-900 to-fuchsia-950", dot: "bg-pink-400", border: "border-pink-500" },
    "mint": { gradient: "from-emerald-900 to-teal-950", dot: "bg-emerald-400", border: "border-emerald-500" },
    "lavender": { gradient: "from-violet-900 to-purple-950", dot: "bg-violet-400", border: "border-violet-500" },
  };

  // Sounds tab states
  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-sounds-enabled'); return v !== null ? v === 'true' : true; }
    return true;
  });
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') return parseInt(storeGet('nnn-volume') || '50', 10);
    return 50;
  });
  const [defaultSound, setDefaultSound] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-default-sound') || 'Beep';
    return 'Beep';
  });
  const [showSoundSelector, setShowSoundSelector] = useState(false);
  const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
  const [showCustomSounds, setShowCustomSounds] = useState(false);
  const [defaultColor, setDefaultColor] = useState(propsDefaultColor);
  const [showColorSelector, setShowColorSelector] = useState(false);
  const [notificationMode, setNotificationMode] = useState<"all" | "specific">(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-notification-mode'); return v === 'specific' ? 'specific' : 'all'; }
    return 'all';
  });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image layout state
  const [imageLayout, setImageLayout] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-image-layout') || 'Grid Layout';
    return 'Grid Layout';
  });

  // Highlights tab states - use props if provided
  const highlightingEnabled = propsHighlightingEnabled;
  const setHighlightingEnabled = (enabled: boolean) => onHighlightingEnabledChange?.(enabled);
  const highlightSoundsEnabled = propsHighlightSoundsEnabled;
  const setHighlightSoundsEnabled = (enabled: boolean) => onHighlightSoundsEnabledChange?.(enabled);
  const keywords = propsKeywords;
  const setKeywords = (kw: Keyword[]) => onKeywordsChange?.(kw);

  const [newKeyword, setNewKeyword] = useState("");
  const [testTweetText, setTestTweetText] = useState("");
  const [testTweets, setTestTweets] = useState<Array<{id: string, text: string}>>([]);

  // Use props for custom notifications
  const customNotifications = propsCustomNotifications;

  // Persist settings to localStorage
  useEffect(() => { storeSet('nnn-sounds-enabled', String(soundsEnabled)); }, [soundsEnabled]);
  useEffect(() => { storeSet('nnn-volume', String(volume)); }, [volume]);
  useEffect(() => { storeSet('nnn-default-sound', defaultSound); }, [defaultSound]);
  useEffect(() => { storeSet('nnn-notification-mode', notificationMode); }, [notificationMode]);
  useEffect(() => { storeSet('nnn-image-layout', imageLayout); }, [imageLayout]);
  useEffect(() => { storeSet('nnn-pause-on-hover', String(pauseOnHover)); }, [pauseOnHover]);
  useEffect(() => { storeSet('nnn-card-width', String(cardWidth)); }, [cardWidth]);
  useEffect(() => { storeSet('nnn-card-scale', String(cardScale)); }, [cardScale]);

  // Sound list
  const soundOptions = [
    "None", "Beep", "Ding", "Chime", "Coin", "Buzz", "Harsh Buzz",
    "Electric Shock", "Metal Clang", "Chainsaw", "Destroyer",
    "UX1", "UX2", "UX3", "UX4", "UX5", "UX6", "uxento"
  ];

  // Color palette
  const colorPalette = [
    "#FF6B6B", "#FFA500", "#FFFF00", "#00FF00", "#5EEAD4",
    "#00FFFF", "#6B9BFF", "#A78BFA", "#FF00FF", "#FFB3D9",
    "#FFFFFF", "#FFD700"
  ];

  // Play sound preview
  const playSound = (soundName: string) => {
    // Don't play anything if "None" is selected
    if (soundName === "None") return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    gainNode.gain.setValueAtTime(volume / 100, audioContext.currentTime);

    // Different sounds with different frequencies and types
    switch(soundName) {
      case "Beep":
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.type = "sine";
        break;
      case "Ding":
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator.type = "sine";
        break;
      case "Chime":
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.type = "triangle";
        break;
      case "Coin":
        oscillator.frequency.setValueAtTime(1500, audioContext.currentTime);
        oscillator.type = "square";
        break;
      case "Buzz":
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        oscillator.type = "sawtooth";
        break;
      case "Harsh Buzz":
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.type = "sawtooth";
        break;
      case "Electric Shock":
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.type = "square";
        break;
      case "Metal Clang":
        oscillator.frequency.setValueAtTime(2000, audioContext.currentTime);
        oscillator.type = "square";
        break;
      case "Chainsaw":
        oscillator.frequency.setValueAtTime(80, audioContext.currentTime);
        oscillator.type = "sawtooth";
        break;
      case "Destroyer":
        oscillator.frequency.setValueAtTime(50, audioContext.currentTime);
        oscillator.type = "sawtooth";
        break;
      default:
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
        oscillator.type = "sine";
    }

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  // Handle custom sound upload
  const handleCustomSoundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "audio/mpeg" || file.type === "audio/wav") {
        const newSound: CustomSound = {
          id: Date.now().toString(),
          name: file.name.replace(/\.(mp3|wav)$/, ""),
          file: file,
          url: URL.createObjectURL(file),
          size: file.size
        };
        setCustomSounds([...customSounds, newSound]);
      }
    }
  };

  // Delete custom sound
  const deleteCustomSound = (id: string) => {
    setCustomSounds(customSounds.filter(s => s.id !== id));
  };

  // Add custom notification
  const addCustomNotification = (username: string, color: string, sound: string) => {
    const newNotification: CustomNotification = {
      id: Date.now().toString(),
      username: username.startsWith("@") ? username : `@${username}`,
      color,
      sound
    };
    if (onCustomNotificationsChange) {
      onCustomNotificationsChange([...customNotifications, newNotification]);
    }
    setShowAddAccount(false);
  };

  // Delete custom notification
  const deleteCustomNotification = (id: string) => {
    if (onCustomNotificationsChange) {
      onCustomNotificationsChange(customNotifications.filter(n => n.id !== id));
    }
  };

  // Keyword management functions
  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const keyword: Keyword = {
      id: Date.now().toString(),
      text: newKeyword.trim(),
      color: "#FFFF00",
      matchMode: "contains",
      sound: "None"
    };
    setKeywords([...keywords, keyword]);
    setNewKeyword("");
  };

  const deleteKeyword = (id: string) => {
    setKeywords(keywords.filter(k => k.id !== id));
  };

  const updateKeywordColor = (id: string, color: string) => {
    setKeywords(keywords.map(k => k.id === id ? {...k, color} : k));
  };

  const updateKeywordMatchMode = (id: string, mode: "contains" | "exact") => {
    setKeywords(keywords.map(k => k.id === id ? {...k, matchMode: mode} : k));
  };

  const updateKeywordSound = (id: string, sound: string) => {
    setKeywords(keywords.map(k => k.id === id ? {...k, sound} : k));
  };

  // Test tweet functions
  const addTestTweet = () => {
    if (!testTweetText.trim()) return;
    const newTweet = {
      id: Date.now().toString(),
      text: testTweetText.trim()
    };
    setTestTweets([newTweet, ...testTweets]);
    setTestTweetText("");

    // Check for keyword matches and play sounds
    if (highlightingEnabled && highlightSoundsEnabled) {
      keywords.forEach(keyword => {
        const textLower = newTweet.text.toLowerCase();
        const keywordLower = keyword.text.toLowerCase();
        const matches = keyword.matchMode === "exact"
          ? textLower.split(/\s+/).includes(keywordLower)
          : textLower.includes(keywordLower);

        if (matches && keyword.sound !== "None") {
          playSound(keyword.sound);
        }
      });
    }
  };

  const highlightText = (text: string) => {
    if (!highlightingEnabled || keywords.length === 0) {
      return <span>{text}</span>;
    }

    let parts: Array<{text: string, color?: string}> = [{text}];

    keywords.forEach(keyword => {
      const newParts: Array<{text: string, color?: string}> = [];

      parts.forEach(part => {
        if (part.color) {
          newParts.push(part);
          return;
        }

        const textLower = part.text.toLowerCase();
        const keywordLower = keyword.text.toLowerCase();

        if (keyword.matchMode === "exact") {
          const words = part.text.split(/(\s+)/);
          words.forEach(word => {
            if (word.toLowerCase() === keywordLower) {
              newParts.push({text: word, color: keyword.color});
            } else {
              newParts.push({text: word});
            }
          });
        } else {
          const index = textLower.indexOf(keywordLower);
          if (index === -1) {
            newParts.push(part);
          } else {
            if (index > 0) {
              newParts.push({text: part.text.substring(0, index)});
            }
            newParts.push({
              text: part.text.substring(index, index + keyword.text.length),
              color: keyword.color
            });
            if (index + keyword.text.length < part.text.length) {
              newParts.push({text: part.text.substring(index + keyword.text.length)});
            }
          }
        }
      });

      parts = newParts;
    });

    return (
      <>
        {parts.map((part, i) =>
          part.color ? (
            <span key={i} style={{ backgroundColor: part.color, color: '#000', fontWeight: 'bold', padding: '2px 4px', borderRadius: '3px' }}>
              {part.text}
            </span>
          ) : (
            <span key={i}>{part.text}</span>
          )
        )}
      </>
    );
  };


  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`w-full max-w-3xl max-h-[90vh] p-0 flex flex-col overflow-hidden ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
        <DialogTitle className="sr-only">Settings</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Settings</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1 rounded-md hover:bg-white/[0.06]">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="appearance" className="flex-1 flex flex-col overflow-hidden">
          <TabsList>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="sounds">Sounds</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="highlights">Highlights</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
          </TabsList>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="flex-1 overflow-y-auto p-5">
            <div className="space-y-5">
              {/* Color Theme — inline grid */}
              <div>
                <h3 className="section-label mb-3">Color Theme</h3>
                <div className="grid grid-cols-5 gap-2">
                  {Object.values(themeDefinitions).map((t) => {
                    const preview = themePreviewData[t.id];
                    if (!preview) return null;
                    const isActive = currentTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => onThemeChange(t.id)}
                        className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-lg transition-all ${
                          isActive ? 'bg-white/[0.08] ring-1 ring-white/20' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`w-full h-10 rounded-md border ${preview.border} bg-gradient-to-br ${preview.gradient} relative overflow-hidden`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
                          <div className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ${preview.dot}`} />
                          {isActive && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] font-medium truncate w-full text-center ${isActive ? 'text-white' : 'text-white/50'}`}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Image Layout */}
              <div>
                <h3 className="section-label mb-2">Image Layout</h3>
                <Select value={imageLayout} onValueChange={setImageLayout}>
                  <SelectTrigger className="w-full px-4 py-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Grid Layout">Grid Layout</SelectItem>
                    <SelectItem value="List Layout">List Layout</SelectItem>
                    <SelectItem value="Compact Layout">Compact Layout</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Card Width */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-label">Card Width</h3>
                  <span className="text-xs text-white/50 font-mono">{cardWidth}px</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="1200"
                  value={cardWidth}
                  onChange={(e) => setCardWidth(Number(e.target.value))}
                  className="slider-premium"
                />
                <div className="flex justify-between text-[10px] text-white/25 mt-1.5">
                  <span>500px</span>
                  <span>1200px</span>
                </div>
              </div>

              {/* Card Scale */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-label">Card Scale</h3>
                  <span className="text-xs text-white/50 font-mono">{cardScale}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={cardScale}
                  onChange={(e) => setCardScale(Number(e.target.value))}
                  className="slider-premium"
                />
                <div className="flex justify-between text-[10px] text-white/25 mt-1.5">
                  <span>50%</span>
                  <span>150%</span>
                </div>
              </div>

              {/* Pause Updates */}
              <div className="flex items-center justify-between py-2 border-t border-white/[0.06] pt-4">
                <div>
                  <span className="text-[12px] font-medium text-white/80">Pause updates on hover</span>
                  <span className="text-[10px] text-white/25 block mt-0.5">Freezes the feed when hovering over cards</span>
                </div>
                <Switch checked={pauseOnHover} onCheckedChange={setPauseOnHover} />
              </div>

              {/* Live Prices */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <span className="text-[12px] font-medium text-white/80">Live prices</span>
                  <span className="text-[10px] text-white/25 block mt-0.5">Show SOL, BTC, ETH prices in the header</span>
                </div>
                <Switch checked={showPrices} onCheckedChange={(v) => onShowPricesChange?.(v)} />
              </div>
            </div>
          </TabsContent>

          {/* Sounds Tab */}
          <TabsContent value="sounds" className="flex-1 overflow-y-auto p-5">
            <div className="text-white space-y-5">
              {/* Enable Notification Sounds */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-white/80">Notification sounds</span>
                  <span className="text-[10px] text-white/25 block mt-0.5">Play a sound when new tweets arrive</span>
                </div>
                <Switch checked={soundsEnabled} onCheckedChange={setSoundsEnabled} />
              </div>

              {/* Volume Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="section-label">Volume</h3>
                  <span className="text-xs text-white/50 font-mono">{volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="slider-premium"
                  disabled={!soundsEnabled}
                />
              </div>

              {/* Default Sound */}
              <div>
                <h3 className="section-label mb-2">Default Sound</h3>
                <button
                  onClick={() => setShowSoundSelector(true)}
                  disabled={!soundsEnabled}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.08] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed settings-row"
                >
                  <div className="flex items-center gap-3">
                    <Play size={18} />
                    <span>{defaultSound}</span>
                  </div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Custom Sounds */}
              <div>
                <h3 className="section-label mb-2">Custom Sounds</h3>
                <button
                  onClick={() => setShowCustomSounds(true)}
                  disabled={!soundsEnabled}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.08] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed settings-row"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                    </svg>
                    <span>Manage Custom Sounds</span>
                    {customSounds.length > 0 && (
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {customSounds.length}
                      </span>
                    )}
                  </div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Default Highlight Color */}
              <div>
                <h3 className="section-label mb-2">Default Highlight Color</h3>
                <button
                  onClick={() => setShowColorSelector(true)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg border border-white/[0.08] text-white transition-colors settings-row"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg border-2 border-white/30"
                      style={{ backgroundColor: defaultColor }}
                    ></div>
                    <span>{defaultColor === "#00FFFF" ? "Cyan" : "Custom"}</span>
                  </div>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Notification Mode */}
              <div>
                <h3 className="section-label mb-2">Notification Mode</h3>
                <Select
                  value={notificationMode}
                  onValueChange={(val) => setNotificationMode(val as "all" | "specific")}
                  disabled={!soundsEnabled}
                >
                  <SelectTrigger className="w-full px-4 py-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="specific">Specific Accounts Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-white/25 mt-1.5">
                  {notificationMode === "all"
                    ? "Notifies for everyone (with custom overrides below)."
                    : "Only notifies for accounts in your list below."}
                </p>
              </div>

              {/* Custom Notifications */}
              <div className="border-t border-white/[0.06] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-label">Custom Notifications</h3>
                  <Button
                    onClick={() => setShowAddAccount(true)}
                    size="lg"
                    className="gap-2"
                  >
                    <span className="text-lg">+</span>
                    <span>Add</span>
                  </Button>
                </div>

                {/* Search Box */}
                <div className="relative mb-4">
                  <Input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 py-2 text-sm"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>

                {/* Custom Notifications List */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customNotifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No custom notifications yet. Click &quot;Add&quot; to create one.
                    </div>
                  ) : (
                    customNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/[0.08]"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded border-2 border-white/30 flex-shrink-0"
                            style={{ backgroundColor: notification.color }}
                          ></div>
                          <span className="text-white font-medium">{notification.username}</span>
                          <span className="text-gray-400 text-sm">&#8226; {notification.sound}</span>
                        </div>
                        <button
                          onClick={() => deleteCustomNotification(notification.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Contracts Tab */}
          <TabsContent value="contracts" className="flex-1 overflow-y-auto p-5">
            <div className="text-white">
              <p className="text-[11px] text-white/30">Contract settings will be configured here.</p>
            </div>
          </TabsContent>

          {/* Highlights Tab */}
          <TabsContent value="highlights" className="flex-1 overflow-y-auto p-5">
            <div className="text-white space-y-5">
              {/* Enable Word Highlighting */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-white/80">Word highlighting</span>
                  <span className="text-[10px] text-white/25 block mt-0.5">Keywords will be highlighted in bright colors</span>
                </div>
                <Switch checked={highlightingEnabled} onCheckedChange={setHighlightingEnabled} />
              </div>

              {/* Enable Sound Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[12px] font-medium text-white/80">Sound on keyword match</span>
                  <span className="text-[10px] text-white/25 block mt-0.5">Play a sound when a keyword is detected</span>
                </div>
                <Switch
                  checked={highlightSoundsEnabled}
                  onCheckedChange={setHighlightSoundsEnabled}
                  disabled={!highlightingEnabled}
                />
              </div>

              {/* Add Keyword Section */}
              <div className="border-t border-white/[0.06] pt-5">
                <h3 className="section-label mb-3">Add Keyword</h3>
                <div className="flex gap-3">
                  <Input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addKeyword()}
                    placeholder="Enter keyword to highlight..."
                    disabled={!highlightingEnabled}
                    className="flex-1 px-4 py-2"
                  />
                  <Button
                    onClick={addKeyword}
                    disabled={!highlightingEnabled || !newKeyword.trim()}
                    size="lg"
                    className="px-6"
                  >
                    Add Keyword
                  </Button>
                </div>
              </div>

              {/* Keywords List */}
              <div className="border-t border-white/[0.06] pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="section-label">
                    Keywords {keywords.length > 0 && <span className="text-white/30">({keywords.length})</span>}
                  </h3>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {keywords.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No keywords added yet. Add keywords above to start highlighting.
                    </div>
                  ) : (
                    keywords.map((keyword) => (
                      <div
                        key={keyword.id}
                        className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-lg border border-white/[0.08]"
                      >
                        {/* Color Picker Button */}
                        <div className="relative group">
                          <button
                            className="w-10 h-10 rounded-lg border-2 border-white/30 hover:border-white/60 transition-all flex-shrink-0"
                            style={{ backgroundColor: keyword.color }}
                            onClick={(e) => {
                              const button = e.currentTarget;
                              const existingPicker = button.parentElement?.querySelector('.color-picker-dropdown');
                              if (existingPicker) {
                                existingPicker.remove();
                              } else {
                                const picker = document.createElement('div');
                                picker.className = `color-picker-dropdown absolute top-12 left-0 ${theme.panel1ContentBg} rounded-lg border border-white/[0.08] p-3 z-10 shadow-xl`;
                                picker.innerHTML = `
                                  <div class="grid grid-cols-6 gap-2">
                                    ${colorPalette.map(color => `
                                      <button
                                        class="w-8 h-8 rounded-lg border-2 ${keyword.color === color ? 'border-white' : 'border-gray-700'} hover:scale-110 transition-all"
                                        style="background-color: ${color}"
                                        data-color="${color}"
                                      ></button>
                                    `).join('')}
                                  </div>
                                `;
                                button.parentElement?.appendChild(picker);

                                picker.querySelectorAll('button').forEach(btn => {
                                  btn.addEventListener('click', () => {
                                    const color = btn.getAttribute('data-color');
                                    if (color) {
                                      updateKeywordColor(keyword.id, color);
                                      picker.remove();
                                    }
                                  });
                                });

                                setTimeout(() => {
                                  const closeOnClickOutside = (e: MouseEvent) => {
                                    if (!picker.contains(e.target as Node) && !button.contains(e.target as Node)) {
                                      picker.remove();
                                      document.removeEventListener('click', closeOnClickOutside);
                                    }
                                  };
                                  document.addEventListener('click', closeOnClickOutside);
                                }, 0);
                              }
                            }}
                          />
                        </div>

                        {/* Keyword Text */}
                        <div className="flex-1 min-w-0">
                          <span className="text-white font-medium truncate block">{keyword.text}</span>
                        </div>

                        {/* Match Mode Toggle */}
                        <div className="flex gap-1 bg-black/30 rounded-lg p-1">
                          <button
                            onClick={() => updateKeywordMatchMode(keyword.id, "contains")}
                            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                              keyword.matchMode === "contains"
                                ? "bg-blue-600 text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            Contains
                          </button>
                          <button
                            onClick={() => updateKeywordMatchMode(keyword.id, "exact")}
                            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                              keyword.matchMode === "exact"
                                ? "bg-blue-600 text-white"
                                : "text-gray-400 hover:text-white"
                            }`}
                          >
                            Exact
                          </button>
                        </div>

                        {/* Sound Dropdown */}
                        <Select
                          value={keyword.sound}
                          onValueChange={(val) => updateKeywordSound(keyword.id, val)}
                          disabled={!highlightSoundsEnabled}
                        >
                          <SelectTrigger className={`w-auto min-w-[120px] px-3 py-1.5 ${theme.inputBg} ${theme.inputBorder} text-sm`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {soundOptions.map((sound) => (
                              <SelectItem key={sound} value={sound}>
                                {sound}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Test Sound Button */}
                        <button
                          onClick={() => playSound(keyword.sound)}
                          disabled={!highlightSoundsEnabled}
                          className="text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Test sound"
                        >
                          <Play size={16} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => deleteKeyword(keyword.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete keyword"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Test Highlighting Section */}
              <div className="border-t border-white/[0.06] pt-5">
                <h3 className="section-label mb-1">Test Highlighting</h3>
                <p className="text-[10px] text-white/25 mb-3">Type a message and press Enter to test</p>

                <Input
                  type="text"
                  value={testTweetText}
                  onChange={(e) => setTestTweetText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTestTweet()}
                  placeholder="Type a test message here..."
                  className="text-xs"
                />

                {/* Test Tweets Display */}
                <div className="mt-4 space-y-3 max-h-60 overflow-y-auto">
                  {testTweets.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm">
                      No test tweets yet. Type a message above and press Enter.
                    </div>
                  ) : (
                    testTweets.map((tweet) => (
                      <div
                        key={tweet.id}
                        className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                            U
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-semibold text-sm">@user</span>
                              <span className="text-gray-400 text-xs">&#8226; just now</span>
                            </div>
                            <div className="text-white text-sm break-words">
                              {highlightText(tweet.text)}
                            </div>
                          </div>
                          <button
                            onClick={() => setTestTweets(testTweets.filter(t => t.id !== tweet.id))}
                            className="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Delete test tweet"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="flex-1 overflow-y-auto p-5">
            <AdvancedTab />
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="flex-1 overflow-y-auto p-5">
            <div className="space-y-6">
              {/* Preset Layouts */}
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Preset Layouts</h3>
                <p className="text-[11px] text-white/30 mb-3">Click a preset to apply it instantly. You can also drag panels to reorder them.</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'default', name: 'Default', layout: [['deploy', 'canvas'], ['search', 'images'], 'ai', 'feed'] as Array<string | [string, string]>, order: ['deploy', 'canvas', 'search', 'images', 'ai', 'feed'], visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } as Record<string, boolean>, desc: 'Deploy + Canvas stacked' },
                    { id: 'feed-first', name: 'Feed First', layout: ['feed', ['deploy', 'canvas'], ['search', 'images'], 'ai'] as Array<string | [string, string]>, order: ['feed', 'deploy', 'canvas', 'search', 'images', 'ai'], visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } as Record<string, boolean>, desc: 'Tweet feed on the left' },
                    { id: 'minimal', name: 'Minimal', layout: ['deploy', 'feed', 'canvas', 'search', 'images', 'ai'] as Array<string | [string, string]>, order: ['deploy', 'feed', 'canvas', 'search', 'images', 'ai'], visibility: { deploy: true, canvas: false, search: false, images: false, ai: false, feed: true } as Record<string, boolean>, desc: 'Deploy + Feed only' },
                    { id: 'research', name: 'Research', layout: [['search', 'images'], 'feed', 'ai', ['deploy', 'canvas']] as Array<string | [string, string]>, order: ['search', 'images', 'feed', 'ai', 'deploy', 'canvas'], visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } as Record<string, boolean>, desc: 'Search & images first' },
                    { id: 'deploy-focus', name: 'Deploy Focus', layout: ['feed', ['ai', 'deploy'], 'canvas', 'search', 'images'] as Array<string | [string, string]>, order: ['feed', 'ai', 'deploy', 'canvas', 'search', 'images'], visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } as Record<string, boolean>, desc: 'AI + Deploy stacked' },
                    { id: 'separated', name: 'All Separate', layout: ['deploy', 'canvas', 'search', 'images', 'ai', 'feed'] as Array<string | [string, string]>, order: ['deploy', 'canvas', 'search', 'images', 'ai', 'feed'], visibility: { deploy: true, canvas: true, search: true, images: true, ai: true, feed: true } as Record<string, boolean>, desc: 'All panels side by side' },
                  ]).map((preset) => {
                    const isActive = JSON.stringify(panelOrder) === JSON.stringify(preset.order)
                      && Object.keys(preset.visibility).every(k => ((panelVisibility as Record<string, boolean>)[k] !== false) === (preset.visibility as Record<string, boolean>)[k]);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => onApplyPreset?.(preset)}
                        className={`text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? 'border-blue-500/40 bg-blue-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Mini wireframe */}
                        <div className="flex gap-[2px] h-5 mb-2 rounded overflow-hidden bg-white/[0.03]">
                          {(preset.layout || preset.order).filter(slot => {
                            if (Array.isArray(slot)) return slot.some(id => preset.visibility[id]);
                            return preset.visibility[slot as string];
                          }).map((slot, i) => {
                            const colorFor = (id: string) =>
                              id === 'deploy' ? 'bg-blue-500/25' :
                              id === 'search' ? 'bg-cyan-500/25' :
                              id === 'images' ? 'bg-purple-500/25' :
                              id === 'ai' ? 'bg-emerald-500/25' :
                              'bg-orange-500/25';
                            const flexFor = (id: string) =>
                              id === 'ai' ? 0.3 : id === 'feed' ? 1.5 : id === 'search' ? 0.7 : 1;

                            if (Array.isArray(slot)) {
                              return (
                                <div key={i} className="flex flex-col gap-[1px] rounded-sm overflow-hidden" style={{ flex: 1 }}>
                                  {slot.filter(id => preset.visibility[id]).map(id => (
                                    <div key={id} className={`flex-1 ${colorFor(id)}`} />
                                  ))}
                                </div>
                              );
                            }
                            return (
                              <div
                                key={slot as string}
                                className={`flex-1 rounded-sm ${colorFor(slot as string)}`}
                                style={{ flex: flexFor(slot as string) }}
                              />
                            );
                          })}
                        </div>
                        <span className={`text-[11px] font-semibold block ${isActive ? 'text-blue-400' : 'text-white/70'}`}>{preset.name}</span>
                        <span className="text-[9px] text-white/25 block">{preset.desc}</span>
                        {isActive && <span className="text-[8px] text-blue-400/60 mt-1 block">Active</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Panel Order */}
              <div className="border-t border-white/[0.06] pt-4">
                <h3 className="text-sm font-bold text-white mb-1">Current Order</h3>
                <p className="text-[11px] text-white/30 mb-3">Drag the thin bar at the top of any panel to reorder. Current layout:</p>
                <div className="flex gap-1.5">
                  {panelOrder.map((id) => {
                    const labels: Record<string, string> = { deploy: 'Deploy', search: 'Search', images: 'Images', ai: 'AI', feed: 'Feed' };
                    const colorMap: Record<string, string> = {
                      deploy: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
                      search: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400',
                      images: 'border-purple-500/20 bg-purple-500/10 text-purple-400',
                      ai: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
                      feed: 'border-orange-500/20 bg-orange-500/10 text-orange-400',
                    };
                    const hidden = (panelVisibility as Record<string, boolean>)[id] === false;
                    return (
                      <div
                        key={id}
                        className={`flex-1 py-2 px-2 rounded border text-center text-[10px] font-semibold transition-all ${
                          hidden
                            ? 'border-white/[0.04] bg-white/[0.01] text-white/15 line-through'
                            : colorMap[id] || 'border-white/[0.06] bg-white/[0.03] text-white/50'
                        }`}
                      >
                        {labels[id] || id}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel Visibility */}
              <div className="border-t border-white/[0.06] pt-4">
                <h3 className="text-sm font-bold text-white mb-1">Panel Visibility</h3>
                <p className="text-[11px] text-white/30 mb-3">Toggle panels on or off.</p>
                <div className="space-y-1.5">
                  {([
                    { id: 'deploy', label: 'Deploy Form' },
                    { id: 'canvas', label: 'Canvas' },
                    { id: 'search', label: 'Token Search' },
                    { id: 'images', label: 'Image Browser' },
                    { id: 'ai', label: 'AI Picks' },
                    { id: 'feed', label: 'Tweet Feed' },
                  ] as const).map((panel) => (
                    <div
                      key={panel.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
                        panelVisibility[panel.id] !== false
                          ? 'border-white/[0.06] bg-white/[0.02]'
                          : 'border-white/[0.03] bg-transparent opacity-50'
                      }`}
                    >
                      <span className="text-[11px] font-semibold text-white/70">{panel.label}</span>
                      <Switch
                        checked={panelVisibility[panel.id] !== false}
                        onCheckedChange={() => onTogglePanel?.(panel.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onResetLayout?.()}
                >
                  Reset to Default Layout
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

      {/* Sound Selector Modal */}
      <Dialog open={showSoundSelector} onOpenChange={(open) => !open && setShowSoundSelector(false)}>
        <DialogContent className={`z-[60] w-full max-w-lg max-h-[80vh] p-0 overflow-hidden flex flex-col ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <DialogTitle className="sr-only">Select Default Sound</DialogTitle>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Play size={20} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-white/90">Select Default Sound</h3>
            </div>
            <button onClick={() => setShowSoundSelector(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              {soundOptions.map((sound) => (
                <div
                  key={sound}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    defaultSound === sound
                      ? "bg-blue-600/20 border-blue-500/40 text-white"
                      : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  <button
                    onClick={() => playSound(sound)}
                    className="text-white hover:text-blue-300 transition-colors p-1"
                    title="Play sound"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    onClick={() => setDefaultSound(sound)}
                    className="flex-1 text-left text-sm font-medium"
                  >
                    {sound}
                  </button>
                  {defaultSound === sound && (
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Sounds Modal */}
      <Dialog open={showCustomSounds} onOpenChange={(open) => !open && setShowCustomSounds(false)}>
        <DialogContent className={`z-[60] w-full max-w-lg max-h-[80vh] p-0 overflow-hidden flex flex-col ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <DialogTitle className="sr-only">Custom Sounds</DialogTitle>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
              <h3 className="text-sm font-semibold text-white/90">Custom Sounds</h3>
            </div>
            <button onClick={() => setShowCustomSounds(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="lg"
              className="w-full gap-2 py-4 mb-4"
            >
              <Upload size={18} />
              <span>Upload Custom Sound</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav"
              onChange={handleCustomSoundUpload}
              className="hidden"
            />
            <p className="text-xs text-gray-400 text-center mb-4">
              Supports MP3, WAV, OGG, and other audio formats
            </p>

            <div className="space-y-2">
              {customSounds.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No custom sounds uploaded yet
                </div>
              ) : (
                customSounds.map((sound) => (
                  <div
                    key={sound.id}
                    className="flex items-center justify-between p-3 bg-white/[0.03] rounded-lg border border-white/[0.08]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => {
                          const audio = new Audio(sound.url);
                          audio.volume = volume / 100;
                          audio.play();
                        }}
                        className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                      >
                        <Play size={18} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate text-sm">{sound.name}</div>
                        <div className="text-gray-400 text-xs">
                          {(sound.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteCustomSound(sound.id)}
                      className="text-red-400 hover:text-red-300 flex-shrink-0 ml-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Color Selector Modal */}
      <Dialog open={showColorSelector} onOpenChange={(open) => !open && setShowColorSelector(false)}>
        <DialogContent className={`z-[60] w-full max-w-md p-0 overflow-hidden flex flex-col ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <DialogTitle className="sr-only">Select Default Color</DialogTitle>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-white/90">Select Default Color</h3>
            </div>
            <button onClick={() => setShowColorSelector(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-6 gap-3">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setDefaultColor(color);
                    setShowColorSelector(false);
                  }}
                  className={`w-12 h-12 rounded-xl border-4 transition-all hover:scale-110 ${
                    defaultColor === color ? "border-white" : "border-gray-700"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Account Modal */}
      <Dialog open={showAddAccount} onOpenChange={(open) => !open && setShowAddAccount(false)}>
        <DialogContent className={`z-[60] w-full max-w-md p-0 overflow-hidden flex flex-col ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <DialogTitle className="sr-only">Add Account</DialogTitle>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <h3 className="text-sm font-semibold text-white/90">Add Account</h3>
            </div>
            <button onClick={() => setShowAddAccount(false)} className="text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="p-6 space-y-4">
            {/* Twitter Username */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">Twitter Username</label>
              <Input
                id="twitter-username"
                type="text"
                placeholder="@username"
                className="px-4 py-2"
              />
            </div>

            {/* Highlight Color */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">Highlight Color</label>
              <div className="grid grid-cols-6 gap-2">
                {colorPalette.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      (document.getElementById('selected-color') as HTMLInputElement).value = color;
                      document.querySelectorAll('[data-color-btn]').forEach(btn => {
                        btn.classList.remove('ring-4', 'ring-white');
                      });
                      document.querySelector(`[data-color="${color}"]`)?.classList.add('ring-4', 'ring-white');
                    }}
                    data-color-btn
                    data-color={color}
                    className={`w-10 h-10 rounded-lg transition-all hover:scale-110 ${
                      color === "#00FFFF" ? "ring-4 ring-white" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <input
                id="selected-color"
                type="hidden"
                defaultValue="#00FFFF"
              />
            </div>

            {/* Notification Sound */}
            <div>
              <label className="block text-white text-sm font-medium mb-2">Notification Sound</label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {soundOptions.map((sound) => (
                  <button
                    key={sound}
                    onClick={() => {
                      (document.getElementById('selected-sound') as HTMLInputElement).value = sound;
                      playSound(sound);
                      document.querySelectorAll('[data-sound-btn]').forEach(btn => {
                        btn.classList.remove('bg-blue-600', 'border-blue-500');
                        btn.classList.add('bg-gray-800', 'border-gray-700');
                      });
                      document.querySelector(`[data-sound="${sound}"]`)?.classList.remove('bg-gray-800', 'border-gray-700');
                      document.querySelector(`[data-sound="${sound}"]`)?.classList.add('bg-blue-600', 'border-blue-500');
                    }}
                    data-sound-btn
                    data-sound={sound}
                    className={`flex items-center justify-center px-3 py-2 rounded-lg border text-sm transition-all ${
                      sound === "Beep" ? "bg-blue-600/20 border-blue-500/40 text-white" : "bg-white/[0.03] border-white/[0.08] text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    {sound}
                  </button>
                ))}
              </div>
              <input
                id="selected-sound"
                type="hidden"
                defaultValue="Beep"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setShowAddAccount(false)}
                size="lg"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const username = (document.getElementById('twitter-username') as HTMLInputElement).value;
                  const color = (document.getElementById('selected-color') as HTMLInputElement).value;
                  const sound = (document.getElementById('selected-sound') as HTMLInputElement).value;

                  if (username.trim()) {
                    addCustomNotification(username, color, sound);
                  }
                }}
                size="lg"
                className="flex-1"
              >
                Add Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Advanced Tab: API Keys Config ---
function AdvancedTab() {
  const [groqKey, setGroqKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [groqSaved, setGroqSaved] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [axiomStatus, setAxiomStatus] = useState<boolean | null>(null);

  useEffect(() => {
    const storedGroq = storeGet("groq-api-key");
    if (storedGroq) setGroqKey(storedGroq);
    const storedGemini = storeGet("nnn-gemini-key");
    if (storedGemini) setGeminiKey(storedGemini);
    const storedAi = storeGet("ai-enabled");
    if (storedAi !== null) setAiEnabled(storedAi !== 'false');
    // Check Axiom cookie status
    fetch('/api/axiom-cookie').then(r => r.json()).then(d => setAxiomStatus(d.configured)).catch(() => {});
  }, []);

  return (
    <div className="text-white space-y-6">
      <div>
        <h3 className="section-label mb-1">Advanced</h3>
        <p className="text-[10px] text-white/25">Configure external API connections</p>
      </div>

      {/* Axiom Status (read-only) */}
      <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08] space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Axiom Token Search</h4>
            <p className="text-[10px] text-white/25 mt-0.5">Managed by server admin</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${axiomStatus === true ? 'bg-green-500' : axiomStatus === false ? 'bg-red-500' : 'bg-gray-500'}`} />
        </div>
        <p className="text-[10px] text-white/30">
          {axiomStatus === true ? 'Axiom cookie is configured and active.' : axiomStatus === false ? 'Axiom cookie not set. Contact admin.' : 'Checking...'}
        </p>
      </div>

      {/* Groq API Key Section */}
      <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">AI Suggestions (Groq)</h4>
            <p className="text-[10px] text-white/25 mt-0.5">Paste your Groq API key to enable AI name suggestions</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${groqKey.trim() ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <input
          type="password"
          value={groqKey}
          onChange={(e) => setGroqKey(e.target.value)}
          placeholder="gsk_..."
          className="w-full bg-black/20 text-white text-xs px-3 py-2 rounded-md border border-white/[0.08] focus:outline-none focus:border-blue-500/50 placeholder-white/20 font-mono input-premium"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const trimmed = groqKey.trim();
              if (trimmed) storeSet("groq-api-key", trimmed);
              else storeRemove("groq-api-key");
              setGroqSaved(true);
              setTimeout(() => setGroqSaved(false), 2000);
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              groqSaved ? 'bg-green-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {groqSaved ? 'Saved!' : 'Save Key'}
          </button>
          <button
            onClick={() => {
              setGroqKey("");
              storeRemove("groq-api-key");
              setGroqSaved(true);
              setTimeout(() => setGroqSaved(false), 2000);
            }}
            className="px-4 py-1.5 text-xs font-medium rounded-md text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Clear
          </button>
          <div className="flex-1" />
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-400 hover:text-emerald-300 underline">
            Get free API key
          </a>
        </div>
      </div>

      {/* Gemini API Key Section */}
      <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08] space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">Canvas (Gemini)</h4>
            <p className="text-[10px] text-white/25 mt-0.5">Paste your Gemini API key to generate images in the Canvas panel</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${geminiKey.trim() ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>

        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKey(e.target.value)}
          placeholder="AIza..."
          className="w-full bg-black/20 text-white text-xs px-3 py-2 rounded-md border border-white/[0.08] focus:outline-none focus:border-blue-500/50 placeholder-white/20 font-mono input-premium"
        />

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const trimmed = geminiKey.trim();
              if (trimmed) storeSet("nnn-gemini-key", trimmed);
              else storeRemove("nnn-gemini-key");
              setGeminiSaved(true);
              setTimeout(() => setGeminiSaved(false), 2000);
            }}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              geminiSaved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {geminiSaved ? 'Saved!' : 'Save Key'}
          </button>
          <button
            onClick={() => {
              setGeminiKey("");
              storeRemove("nnn-gemini-key");
              setGeminiSaved(true);
              setTimeout(() => setGeminiSaved(false), 2000);
            }}
            className="px-4 py-1.5 text-xs font-medium rounded-md text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            Clear
          </button>
          <div className="flex-1" />
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">
            Get free API key
          </a>
        </div>
      </div>

      {/* AI On/Off Toggle */}
      <div className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold text-white">AI Highlights</h4>
            <p className="text-[10px] text-white/25 mt-0.5">Show AI-detected token names highlighted in tweets</p>
          </div>
          <Switch
            checked={aiEnabled}
            onCheckedChange={(checked) => {
              setAiEnabled(checked);
              storeSet('ai-enabled', String(checked));
            }}
          />
        </div>
      </div>

    </div>
  );
}
