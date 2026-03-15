"use client";

import { Trash2, X as XIcon, Upload, Crop, ClipboardPaste, Image as ImageLucide, Plus } from "lucide-react";
import { getTheme } from "@/utils/themes";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { getDeploymentService, getWalletPrivateKey, CreateTokenParams, SnipeWallet, getStoredWallets, getRegionKey } from "@/services/tokenApi";
import { storeGet, storeSet } from "@/lib/store";
import Toast from "./Toast";
import { generatePresetImage } from "@/utils/imageGenerator";

function buildTweetUrl(username: string, statusId?: string): string {
  if (statusId) {
    const numericId = statusId.replace(/^[a-zA-Z-]+/, '');
    if (numericId && /^\d+$/.test(numericId)) {
      return `https://x.com/${username}/status/${numericId}`;
    }
  }
  return `https://x.com/${username}`;
}

interface Wallet {
  id: string;
  type: 'solana' | 'evm';
  publicKey: string;
  privateKey: string;
  compositeKey: string;
  balance: number;
  isActive: boolean;
}

interface ToastMessage {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface PresetTriggerData {
  namePrefix: string;
  nameSuffix: string;
  deployPlatform: string;
  tickerMode: string;
  imageType: string;
  selectedText?: string;
  overrideTicker?: string;
  tweetImageUrl?: string;
  tweetLink?: string;
  customImageUrl?: string;
}

interface Tweet {
  id: string;
  twitterStatusId?: string;
  username: string;
  displayName: string;
  handle: string;
  verified: boolean;
  timestamp: string;
  text: string;
  imageUrl?: string;
  profilePic: string;
  highlightColor?: string;
  media?: Array<{ type: 'image' | 'video' | 'gif'; url: string; thumbnail?: string }>;
  quotedTweet?: Tweet;
  repliedToTweet?: Tweet;
  linkPreviews?: Array<{ url: string; title?: string; description?: string; image?: string; domain?: string }>;
  followedUser?: { handle: string; profilePic?: string };
}

// Collect ALL images from a tweet (same logic as Panel3's collectAllImages)
const collectAllTweetImages = (tweet: Tweet): string[] => {
  const images: string[] = [];
  const add = (url: string) => { if (url && !images.includes(url)) images.push(url); };
  // Media images first (highest priority) — for videos, use thumbnail instead of raw video URL
  tweet.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.imageUrl) add(tweet.imageUrl);
  tweet.quotedTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.quotedTweet?.imageUrl) add(tweet.quotedTweet.imageUrl);
  tweet.repliedToTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.repliedToTweet?.imageUrl) add(tweet.repliedToTweet.imageUrl);
  // Link preview images (OG images from articles/links)
  tweet.linkPreviews?.forEach(lp => { if (lp.image) add(lp.image); });
  // Followed user profile pic (follow events)
  if (tweet.followedUser?.profilePic) add(tweet.followedUser.profilePic);
  // Profile pics last (lowest priority)
  if (tweet.profilePic) add(tweet.profilePic);
  if (tweet.quotedTweet?.profilePic) add(tweet.quotedTweet.profilePic);
  if (tweet.repliedToTweet?.profilePic) add(tweet.repliedToTweet.profilePic);
  return images;
};

// Detect video URLs that can't be rendered as <img>
const isVideoUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return lower.includes('video.twimg.com') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.webm') ||
    lower.includes('/ext_tw_video/') ||
    lower.includes('/amplify_video/');
};

// Component that generates a thumbnail from a video URL using canvas
const VideoThumbnailButton = memo(function VideoThumbnailButton({
  videoUrl,
  isSelected,
  onThumbnailGenerated,
  onSelect,
}: {
  videoUrl: string;
  isSelected: boolean;
  onThumbnailGenerated: (videoUrl: string, thumbDataUrl: string) => void;
  onSelect: (thumbDataUrl: string) => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    attemptedRef.current = true;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = `/api/proxy-image?url=${encodeURIComponent(videoUrl)}`;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.removeEventListener('loadeddata', handleLoaded);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
      video.src = '';
      video.load();
    };

    const handleLoaded = () => {
      // Seek to 10% or 1 second, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    const handleSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setThumbnail(dataUrl);
          onThumbnailGenerated(videoUrl, dataUrl);
        }
      } catch {
        setFailed(true);
      }
      cleanup();
    };

    const handleError = () => {
      setFailed(true);
      cleanup();
    };

    video.addEventListener('loadeddata', handleLoaded);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Timeout: if no thumbnail after 20s, give up
    const timer = setTimeout(() => {
      if (!thumbnail && !failed) {
        setFailed(true);
        cleanup();
      }
    }, 20000);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
  }, [videoUrl]); // Only depend on videoUrl - callbacks are stable via closure

  return (
    <button
      onClick={() => { if (thumbnail) onSelect(thumbnail); }}
      className={`relative group w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
        isSelected
          ? 'ring-2 ring-green-500 border border-green-500'
          : 'border border-white/[0.08] hover:border-white/20'
      }`}
    >
      {thumbnail ? (
        <img src={thumbnail} alt="Video frame" className="w-full h-full object-cover" />
      ) : failed ? (
        <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
          <svg className="w-5 h-5 text-white/30" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/[0.06]">
          <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {/* VID badge */}
      <div className="absolute bottom-0.5 left-0.5 bg-black/70 rounded px-1 py-px">
        <span className="text-[8px] text-white font-bold leading-none">VID</span>
      </div>
      {isSelected && (
        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
});

interface VampData {
  tokenName: string;
  tokenSymbol: string;
  tokenImage: string;
  website: string;
  twitter: string;
  platform?: string;
}

interface Panel1Props {
  themeId: string;
  activeWallet: Wallet | null;
  wallets?: Wallet[];
  onWalletSelect?: (wallet: Wallet | null) => void;
  presetTrigger?: PresetTriggerData | null;
  onPresetApplied?: () => void;
  deployedImageUrl?: string | null;
  deployedImageOptions?: string[];
  deployedTwitterUrl?: string | null;
  onImageDeployed?: () => void;
  onTwitterDeployed?: () => void;
  clearTrigger?: number; // When this changes, silently clear all fields
  tweets?: Tweet[]; // All tweets for auto-fill on copy
  testMode?: boolean; // Test mode - shows preview instead of deploying
  onNameChange?: (name: string) => void; // Sync name with parent for Panel2 filtering
  onTokenSearch?: (query: string) => void; // Trigger token search in Panel2
  vampData?: VampData | null;
  onVampApplied?: () => void;
  settingsVersion?: number;
  browserImages?: Array<{ name: string; nameWithoutExt: string; filename: string }>;
  editMode?: boolean;
  forceSelectImage?: boolean;
  variant?: 'default' | 'launchblitz';
}

export default function Panel1({ themeId, activeWallet, wallets = [], onWalletSelect, presetTrigger, onPresetApplied, deployedImageUrl, deployedImageOptions = [], deployedTwitterUrl, onImageDeployed, onTwitterDeployed, clearTrigger, tweets = [], testMode = false, onNameChange, onTokenSearch, vampData, onVampApplied, settingsVersion = 0, browserImages = [], editMode = false, forceSelectImage = false, variant = 'default' }: Panel1Props) {
  const theme = getTheme(themeId);
  
  const logos = [
    { src: '/images/pump-logo.png', alt: 'Pump' },
    { src: '/images/bonk-logo.png', alt: 'Bonk' },
    { src: '/images/usd1-logo.png', alt: 'USD1' },
    { src: '/images/bags-logo.png', alt: 'Bags' },
    { src: '/images/bnb-logo.png', alt: 'BNB' },
    { src: '/images/jupiter-logo.png', alt: 'Jupiter' }
  ];
  
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageOptions, setImageOptions] = useState<string[]>([]);
  const [videoThumbnails, setVideoThumbnails] = useState<Record<string, string>>({}); // videoUrl → dataUrl
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeployRef = useRef(false);
  const pendingQuickDeployRef = useRef<{ amount: number; imageMode: "letter" | "sol" | "ascii" } | null>(null);
  const [platformValues, setPlatformValues] = useState([0.001, 0.001, 0.001, 0.001, 0.001, 0.001]);
  const [isDragging, setIsDragging] = useState(false);
  const [buyAmount, setBuyAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = storeGet('nnn-buy-amount');
      if (saved) return parseFloat(saved) || 0.01;
    }
    return 0.01;
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedPlatformIndex, setSelectedPlatformIndex] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-platform-index'); if (v) return parseInt(v) || 0; } return 0;
  });
  const [bonkersEnabled, setBonkersEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-bonkers') === 'true'; return false;
  });
  const [usd1Currency, setUsd1Currency] = useState<"USD1" | "SOL">(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-usd1-currency'); if (v === 'SOL') return 'SOL'; } return 'USD1';
  });
  const [cashbackEnabled, setCashbackEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-cashback') === 'true'; return false;
  });
  const [bundleEnabled, setBundleEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-bundle') === 'true'; return false;
  });
  const [showBundlePopup, setShowBundlePopup] = useState(false);
  const bundlePopupRef = useRef<HTMLDivElement>(null);
  const bundleButtonRef = useRef<HTMLDivElement>(null);
  const [bundleSnipeWallets, setBundleSnipeWallets] = useState<Record<string, { enabled: boolean; amount: number }>>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet(`nnn-bundle-wallets-${getRegionKey()}`); if (v) return JSON.parse(v); } catch {} } return {};
  });
  const [block0SnipeWallets, setBlock0SnipeWallets] = useState<Record<string, { enabled: boolean }>>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet(`nnn-block0-wallets-${getRegionKey()}`); if (v) return JSON.parse(v); } catch {} } return {};
  });
  const [turboModeEnabled, setTurboModeEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-turbo') !== 'false'; return true;
  });
  const [autoSellEnabled, setAutoSellEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-autosell') === 'true'; return false;
  });
  const [autoSellAll, setAutoSellAll] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-autosell-all') === 'true'; return false;
  });
  const [autoSellDelay, setAutoSellDelay] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-autosell-delay'); if (v) return parseInt(v) || 0; } return 0;
  });
  const [multiDeployEnabled, setMultiDeployEnabled] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-multi') === 'true'; return false;
  });
  const [showMultiPopup, setShowMultiPopup] = useState(false);
  const multiPopupRef = useRef<HTMLDivElement>(null);
  const multiButtonRef = useRef<HTMLDivElement>(null);
  const [multiDeployCount, setMultiDeployCount] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-multi-count'); if (v) return parseInt(v) || 3; } return 3;
  });
  const [multiDeploySecondaryAmount, setMultiDeploySecondaryAmount] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-multi-amount'); if (v) return parseFloat(v) || 0.1; } return 0.1;
  });
  const [selectedImageMode, setSelectedImageMode] = useState<"letter" | "sol" | "ascii">(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-image-mode'); if (v === 'sol' || v === 'ascii') return v; } return 'letter';
  });
  const [deployKeybind, setDeployKeybind] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('insta-deploy-primary') || 'Ctrl + X';
    return 'Ctrl + X';
  });
  // Listen for keybind changes from DeploySettingsModal
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'insta-deploy-primary' && e.newValue) setDeployKeybind(e.newValue);
    };
    // Also poll on custom event (same-tab localStorage writes don't fire StorageEvent)
    const onKeybindChange = () => {
      const v = storeGet('insta-deploy-primary');
      if (v) setDeployKeybind(v);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('nnn-keybind-change', onKeybindChange);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('nnn-keybind-change', onKeybindChange); };
  }, []);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Saved tokens
  const [savedTokens, setSavedTokens] = useState<Array<{ id: string; name: string; symbol: string; image: string | null; platform: number; website: string; twitter: string }>>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet('nnn-saved-tokens'); if (v) return JSON.parse(v); } catch {} }
    return [];
  });
  const [autoFillOnCopy, setAutoFillOnCopy] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-autofill'); if (v !== null) return v === 'true'; } return true;
  });
  const [autoGenerateTicker, setAutoGenerateTicker] = useState(() => {
    if (typeof window !== 'undefined') { const v = storeGet('nnn-autoticker'); if (v !== null) return v === 'true'; } return true;
  });
  const [presetAmounts, setPresetAmounts] = useState<number[]>([1, 2, 3, 4, 5]);
  const [usd1PresetAmounts, setUsd1PresetAmounts] = useState<number[]>([50, 100, 250, 500, 1000]);
  const [isEditingPresets, setIsEditingPresets] = useState(false);
  const [tempPresets, setTempPresets] = useState<string[]>(['1', '2', '3', '4', '5']);
  const [bundlePresetAmounts, setBundlePresetAmounts] = useState<number[]>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet('deployBundlePresetAmounts'); if (v) return JSON.parse(v); } catch {} } return [0.5, 1, 2, 3, 5];
  });
  const [usd1BundlePresetAmounts, setUsd1BundlePresetAmounts] = useState<number[]>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet('deployBundlePresetAmountsUSD1'); if (v) return JSON.parse(v); } catch {} } return [50, 100, 250, 500, 1000];
  });
  const [isEditingBundlePresets, setIsEditingBundlePresets] = useState(false);
  const [tempBundlePresets, setTempBundlePresets] = useState<string[]>(['0.5', '1', '2', '3', '5']);
  const [usd1BuyAmount, setUsd1BuyAmount] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = storeGet('nnn-usd1-buy-amount');
      if (saved) return parseFloat(saved) || 100;
    }
    return 100;
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    name: string;
    symbol: string;
    image: string;
    platform: string;
    amount: number;
    currency: string;
    website: string;
    twitter: string;
    imageSource: string;
    deployerWallet: string;
    bundleEnabled: boolean;
    snipeWallets: { publicKey: string; amount: number }[];
    turboMode: boolean;
    autoSell: boolean;
    autoSellAll: boolean;
    autoSellDelay: number;
    bonkers: boolean;
    cashback: boolean;
    multiDeploy: boolean;
    multiDeployCount: number;
  } | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Wallet dropdown state
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const walletDropdownRef = useRef<HTMLDivElement>(null);

  // Google image search popdown state
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<{ imageUrl: string; thumbnailUrl?: string; title?: string }[]>([]);
  const [isGoogleSearching, setIsGoogleSearching] = useState(false);
  const [googleLoadingIndex, setGoogleLoadingIndex] = useState<number | null>(null);
  const googleSearchRef = useRef<HTMLDivElement>(null);
  const googleInputRef = useRef<HTMLInputElement>(null);

  const platformNames = ["pump", "bonk", "usd1", "bags", "bnb", "jupiter"];

  // Track user's default platform (what they manually selected, not whitelist-overridden)
  const defaultPlatformRef = useRef(selectedPlatformIndex);
  const defaultBonkersRef = useRef(bonkersEnabled);
  const whitelistActiveRef = useRef(false);

  // When user manually changes platform, update the default (only if not a whitelist override)
  const handleManualPlatformChange = useCallback((idx: number) => {
    setSelectedPlatformIndex(idx);
    if (!whitelistActiveRef.current) {
      defaultPlatformRef.current = idx;
    }
  }, []);

  // Check whitelist and auto-switch platform if username matches, reset to default if not
  const checkWhitelistAndSwitchPlatform = useCallback((username: string) => {
    try {
      const raw = storeGet('nnn-whitelists');
      if (!raw) {
        // No whitelists — reset to default if whitelist was active
        if (whitelistActiveRef.current) {
          whitelistActiveRef.current = false;
          setSelectedPlatformIndex(defaultPlatformRef.current);
          setBonkersEnabled(defaultBonkersRef.current);
        }
        return;
      }
      const whitelists: Record<string, Array<string | { username: string; bonkers?: boolean }>> = JSON.parse(raw);
      const lowerUser = username.toLowerCase();
      const platformIndexMap: Record<string, number> = { pump: 0, bonk: 1, usd1: 2, bags: 3, bnb: 4, liquid: 5, nadfun: 3 };
      for (const [platformId, entries] of Object.entries(whitelists)) {
        const match = entries.find(e => {
          const uname = typeof e === 'string' ? e : e.username;
          return uname.toLowerCase() === lowerUser;
        });
        if (match) {
          const idx = platformIndexMap[platformId];
          if (idx !== undefined) {
            // Save defaults before overriding
            if (!whitelistActiveRef.current) {
              defaultPlatformRef.current = selectedPlatformIndex;
              defaultBonkersRef.current = bonkersEnabled;
            }
            whitelistActiveRef.current = true;
            setSelectedPlatformIndex(idx);
            // Auto-toggle bonkers if the entry has a bonkers flag
            if (typeof match === 'object' && match.bonkers !== undefined) {
              setBonkersEnabled(match.bonkers);
            }
          }
          return;
        }
      }
      // No match — reset to default
      if (whitelistActiveRef.current) {
        whitelistActiveRef.current = false;
        setSelectedPlatformIndex(defaultPlatformRef.current);
        setBonkersEnabled(defaultBonkersRef.current);
      }
    } catch {}
  }, [selectedPlatformIndex, bonkersEnabled]);

  // Persist buy amounts to localStorage
  useEffect(() => {
    storeSet('nnn-buy-amount', String(buyAmount));
  }, [buyAmount]);
  useEffect(() => {
    storeSet('nnn-usd1-buy-amount', String(usd1BuyAmount));
  }, [usd1BuyAmount]);

  // Persist all toggle/setting states to localStorage
  useEffect(() => { storeSet('nnn-platform-index', String(selectedPlatformIndex)); }, [selectedPlatformIndex]);
  useEffect(() => { storeSet('nnn-bonkers', String(bonkersEnabled)); }, [bonkersEnabled]);
  useEffect(() => { storeSet('nnn-usd1-currency', usd1Currency); }, [usd1Currency]);
  useEffect(() => { storeSet('nnn-cashback', String(cashbackEnabled)); }, [cashbackEnabled]);
  useEffect(() => { storeSet('nnn-bundle', String(bundleEnabled)); }, [bundleEnabled]);
  useEffect(() => { storeSet(`nnn-bundle-wallets-${getRegionKey()}`, JSON.stringify(bundleSnipeWallets)); }, [bundleSnipeWallets]);
  useEffect(() => { storeSet(`nnn-block0-wallets-${getRegionKey()}`, JSON.stringify(block0SnipeWallets)); }, [block0SnipeWallets]);
  useEffect(() => { storeSet('nnn-turbo', String(turboModeEnabled)); }, [turboModeEnabled]);
  useEffect(() => { storeSet('nnn-autosell', String(autoSellEnabled)); }, [autoSellEnabled]);
  useEffect(() => { storeSet('nnn-autosell-all', String(autoSellAll)); }, [autoSellAll]);
  useEffect(() => { storeSet('nnn-autosell-delay', String(autoSellDelay)); }, [autoSellDelay]);
  useEffect(() => { storeSet('nnn-multi', String(multiDeployEnabled)); }, [multiDeployEnabled]);
  useEffect(() => { storeSet('nnn-multi-count', String(multiDeployCount)); }, [multiDeployCount]);
  useEffect(() => { storeSet('nnn-multi-amount', String(multiDeploySecondaryAmount)); }, [multiDeploySecondaryAmount]);
  useEffect(() => { storeSet('nnn-image-mode', selectedImageMode); }, [selectedImageMode]);
  useEffect(() => { storeSet('nnn-autofill', String(autoFillOnCopy)); }, [autoFillOnCopy]);
  useEffect(() => { storeSet('nnn-autoticker', String(autoGenerateTicker)); }, [autoGenerateTicker]);

  // Use ref to avoid stale closure issues with testMode prop
  const testModeRef = useRef(testMode);
  useEffect(() => {
    testModeRef.current = testMode;
  }, [testMode]);
  
  // Map platform index to deployment platform type
  const getPlatformType = (index: number): "pump" | "bonk" | "usd1" | "bags" => {
    const mapping: { [key: number]: "pump" | "bonk" | "usd1" | "bags" } = {
      0: "pump",   // Pump
      1: "bonk",   // Raydium/Bonk
      2: "usd1",   // USD1
      3: "bags",   // Bags (Meteora DBC)
      4: "bonk",   // BNB -> bonk
      5: "usd1",   // Jupiter -> usd1
    };
    return mapping[index] || "pump";
  };
  
  const selectedPlatform = getPlatformType(selectedPlatformIndex);
  const deploymentService = getDeploymentService();

  // Derived: are we in USD1-quote mode?
  const isUsd1Mode = selectedPlatform === 'usd1' && usd1Currency === 'USD1';

  // Active amount/presets switch based on mode
  const activeAmount = isUsd1Mode ? usd1BuyAmount : buyAmount;
  const setActiveAmount = isUsd1Mode ? setUsd1BuyAmount : setBuyAmount;
  // String display for amount input (allows typing decimals like "0.0001")
  const [amountInputStr, setAmountInputStr] = useState(() => activeAmount ? String(activeAmount) : '');
  // Sync string when amount changes externally (preset buttons, etc.)
  useEffect(() => {
    setAmountInputStr(activeAmount ? String(activeAmount) : '');
  }, [activeAmount]);
  const activePresets = isUsd1Mode ? usd1PresetAmounts : presetAmounts;
  const setActivePresets = isUsd1Mode ? setUsd1PresetAmounts : setPresetAmounts;
  const activePresetsKey = isUsd1Mode ? 'deployPresetAmountsUSD1' : 'deployPresetAmounts';
  const activeCurrencyLabel = isUsd1Mode ? 'USD1' : 'SOL';
  const activeCurrencyIcon = isUsd1Mode ? '/images/usd1-logo.png' : '/images/sol-logo.svg';
  const activeBundlePresets = isUsd1Mode ? usd1BundlePresetAmounts : bundlePresetAmounts;
  const setActiveBundlePresets = isUsd1Mode ? setUsd1BundlePresetAmounts : setBundlePresetAmounts;
  const activeBundlePresetsKey = isUsd1Mode ? 'deployBundlePresetAmountsUSD1' : 'deployBundlePresetAmounts';

  // Toast helper functions - wrapped in useCallback
  const showToast = useCallback((message: string, type: "success" | "error" | "info") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);
  
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Build snipe wallet list for bundle deploys
  const buildSnipeWallets = useCallback((): SnipeWallet[] => {
    if (!bundleEnabled) return [];
    const storedWallets = getStoredWallets();
    return Object.entries(bundleSnipeWallets)
      .filter(([pubkey, config]) => {
        if (!config.enabled) return false;
        if (pubkey === activeWallet?.publicKey) return false;
        return true;
      })
      .slice(0, autoSellEnabled ? 4 : 5)
      .map(([pubkey, config]) => {
        const stored = storedWallets.find(w => w.publicKey === pubkey);
        const privateKey = stored ? getWalletPrivateKey(pubkey) || '' : '';
        const defaultAmount = (selectedPlatform === 'usd1' && usd1Currency === 'USD1') ? 100 : 0.1;
        return {
          publicKey: pubkey,
          privateKey,
          amount: config.amount || defaultAmount,
        };
      });
  }, [bundleEnabled, bundleSnipeWallets, activeWallet, autoSellEnabled, selectedPlatform]);

  // Build extra deploy params shared by all deploy paths
  const getExtraDeployParams = useCallback(() => ({
    currency: selectedPlatform === 'usd1' ? usd1Currency : ("SOL" as const),
    isBonkersEnabled: (selectedPlatform === 'bonk' || selectedPlatform === 'usd1') && bonkersEnabled,
    isCashbackEnabled: selectedPlatform === 'pump' && cashbackEnabled,
    bundleEnabled,
    turboModeEnabled,
    snipeWallets: buildSnipeWallets(),
    autoSell: autoSellEnabled,
    autoSellAll,
    autoSellDelay,
    multiDeploy: multiDeployEnabled,
    multiDeployCount,
    multiDeploySecondaryAmount,
  }), [selectedPlatform, usd1Currency, bonkersEnabled, cashbackEnabled, bundleEnabled, turboModeEnabled, buildSnipeWallets, autoSellEnabled, autoSellAll, autoSellDelay, multiDeployEnabled, multiDeployCount, multiDeploySecondaryAmount]);

  // Clear all form fields (except buy amount - that persists)
  const handleClear = () => {
    setName("");
    onNameChange?.("");
    setSymbol("");
    setWebsite("");
    setTwitter("");
    setUploadedImage(null);
    setImageOptions([]);
    // Don't reset buyAmount - it persists
  };

  useEffect(() => {
    storeSet('nnn-saved-tokens', JSON.stringify(savedTokens));
  }, [savedTokens]);

  const handleSaveToken = () => {
    if (!name.trim() || !symbol.trim()) { showToast("Fill in name and symbol first", "error"); return; }
    const token = { id: Date.now().toString(), name: name.trim(), symbol: symbol.trim(), image: uploadedImage, platform: selectedPlatformIndex, website: website.trim(), twitter: twitter.trim() };
    setSavedTokens(prev => [...prev, token]);
    showToast(`Saved ${symbol.trim()}`, "success");
  };

  const handleLoadSavedToken = (token: typeof savedTokens[0]) => {
    setName(token.name);
    onNameChange?.(token.name);
    setSymbol(token.symbol);
    if (token.image) { setUploadedImage(token.image); setImageOptions([token.image]); }
    setSelectedPlatformIndex(token.platform);
    setWebsite(token.website);
    setTwitter(token.twitter);
    pendingDeployRef.current = true;
  };

  const handleRemoveSavedToken = (id: string) => {
    setSavedTokens(prev => prev.filter(t => t.id !== id));
  };

  const handleClearSavedTokens = () => {
    setSavedTokens([]);
    showToast("Cleared all saved tokens", "info");
  };

  // Auto-sync name to symbol (only when autoGenerateTicker is enabled)
  const handleNameChange = (value: string) => {
    setName(value);
    onNameChange?.(value);

    // Only auto-generate ticker if the checkbox is enabled
    const newSymbol = autoGenerateTicker ? value.replace(/\s/g, '').toUpperCase().slice(0, 13) : undefined;
    if (newSymbol !== undefined) setSymbol(newSymbol);

    // Clear images when both name and symbol are empty
    const effectiveSymbol = newSymbol !== undefined ? newSymbol : symbol;
    if (!value.trim() && !effectiveSymbol.trim()) {
      setImageOptions([]);
      setUploadedImage(null);
    }

    // Debounced auto-search (500ms after last keystroke)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        onTokenSearch?.(trimmed);
      }, 500);
    } else if (trimmed.length === 0) {
      onTokenSearch?.("");
    }
  };
  
  // Handle drag and drop for images
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          setUploadedImage(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };
  
  // Handle platform value changes
  const handlePlatformValueChange = (index: number, value: string) => {
    const newValues = [...platformValues];
    newValues[index] = parseFloat(value) || 0;
    setPlatformValues(newValues);
  };

  // Determine image source label
  const getImageSourceLabel = useCallback((imageUrl: string | null, presetImageType?: string): string => {
    if (presetImageType) return presetImageType;
    if (!imageUrl) return 'Letter Image (generated)';
    if (imageUrl.startsWith('/api/local-images/serve')) return 'Image from uploads folder';
    if (imageUrl.startsWith('data:')) return 'Generated image';
    if (imageUrl.startsWith('/api/proxy-image') || imageUrl.startsWith('http')) return 'Image in post';
    return 'Custom image';
  }, []);

  // Build preview data object with all deploy settings
  const buildPreviewData = useCallback((overrides: {
    tokenName?: string; tokenSymbol?: string; imageToUse: string;
    amount: number; imageSource?: string; tweetLink?: string;
    isBundle?: boolean; bundleWallets?: { publicKey: string; amount: number }[];
  }) => {
    const platformNames: Record<string, string> = { 'pump': 'Pump.fun', 'bonk': 'Bonk', 'usd1': 'USD1' };
    const isUsd1Direct = selectedPlatform === 'usd1' && usd1Currency === 'USD1';
    const currencyLabel = isUsd1Direct ? 'USD1' : 'SOL';

    // Build snipe wallet list for display
    const snipeWalletList = overrides.bundleWallets || buildSnipeWallets().map(w => ({ publicKey: w.publicKey, amount: w.amount }));

    return {
      name: (overrides.tokenName || name).trim(),
      symbol: (overrides.tokenSymbol || symbol).trim(),
      image: overrides.imageToUse,
      platform: platformNames[selectedPlatform] || selectedPlatform,
      amount: overrides.amount,
      currency: currencyLabel,
      website: website.trim(),
      twitter: overrides.tweetLink || twitter.trim(),
      imageSource: overrides.imageSource || getImageSourceLabel(uploadedImage),
      deployerWallet: activeWallet ? activeWallet.publicKey.substring(0, 4) + '...' + activeWallet.publicKey.substring(activeWallet.publicKey.length - 4) : 'None',
      bundleEnabled: overrides.isBundle ?? bundleEnabled,
      snipeWallets: overrides.isBundle === false ? [] : snipeWalletList,
      turboMode: turboModeEnabled,
      autoSell: autoSellEnabled,
      autoSellAll,
      autoSellDelay,
      bonkers: (selectedPlatform === 'bonk' || selectedPlatform === 'usd1') && bonkersEnabled,
      cashback: selectedPlatform === 'pump' && cashbackEnabled,
      multiDeploy: multiDeployEnabled,
      multiDeployCount,
    };
  }, [name, symbol, selectedPlatform, usd1Currency, website, twitter, uploadedImage, activeWallet, bundleEnabled, turboModeEnabled, autoSellEnabled, autoSellAll, autoSellDelay, bonkersEnabled, cashbackEnabled, multiDeployEnabled, multiDeployCount, buildSnipeWallets, getImageSourceLabel]);

  // Generate preview for test mode
  const generatePreview = useCallback(async (amount: number) => {
    if (!name || !symbol) {
      showToast("Please fill in Token Name and Symbol!", "error");
      return;
    }

    setIsDeploying(true);

    try {
      let imageToUse = uploadedImage;
      if (!imageToUse) {
        const imageTypeMap = {
          'letter': 'Letter Image',
          'sol': 'SOL ASCII (Gradient)',
          'ascii': 'ASCII Art'
        };
        imageToUse = await generatePresetImage(
          imageTypeMap[selectedImageMode],
          symbol.trim(),
          undefined,
          selectedPlatform === 'pump' ? 'Pump.fun' : undefined
        );
      }

      setPreviewData(buildPreviewData({ imageToUse, amount }));
      setShowPreview(true);
    } catch (error) {
      showToast(`Failed to generate preview: ${error}`, "error");
    }

    setIsDeploying(false);
  }, [name, symbol, uploadedImage, selectedImageMode, selectedPlatform, showToast, buildPreviewData]);
  
  // Deploy token function - wrapped in useCallback for global Enter handler
  const handleDeploy = useCallback(async () => {
    // Resolve the correct buy amount based on platform/currency
    const deployAmount = (selectedPlatform === 'usd1' && usd1Currency === 'USD1') ? usd1BuyAmount : buyAmount;

    // Test mode - show preview instead of deploying (use ref for current value)
    if (testModeRef.current) {
      await generatePreview(deployAmount);
      return;
    }

    // Validation
    if (!activeWallet) {
      showToast("Please import a wallet first! Click the Stack button (📚) in the top right.", "error");
      return;
    }

    if (!name || !symbol) {
      showToast("Please fill in Token Name and Symbol!", "error");
      return;
    }

    if (deployAmount <= 0) {
      showToast("Buy amount must be greater than 0!", "error");
      return;
    }
    
    setIsDeploying(true);
    
    try {
      // Generate image if none uploaded, using selected image mode
      let imageToUse = uploadedImage;
      if (!imageToUse) {
        const imageTypeMap = {
          'letter': 'Letter Image',
          'sol': 'SOL ASCII (Gradient)',
          'ascii': 'ASCII Art'
        };
        try {
          imageToUse = await generatePresetImage(
            imageTypeMap[selectedImageMode],
            symbol.trim(),
            undefined,
            selectedPlatform === 'pump' ? 'Pump.fun' : undefined
          );
        } catch (imgError) {
          showToast(`Failed to generate image: ${imgError}`, "error");
          setIsDeploying(false);
          return;
        }
      }
      
      await deploymentService.connect();

      const extraParams = getExtraDeployParams();
      const deployParams = {
        platform: selectedPlatform,
        name: name.trim(),
        symbol: symbol.trim(),
        image: imageToUse,
        amount: deployAmount,
        wallet: { publicKey: activeWallet.publicKey, privateKey: getWalletPrivateKey(activeWallet.publicKey) || activeWallet.privateKey },
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        ...extraParams,
      };

      if (extraParams.multiDeploy && extraParams.multiDeployCount && extraParams.multiDeployCount > 1) {
        const isUsd1Direct = selectedPlatform === 'usd1' && usd1Currency === 'USD1';
        const defaultSecondary = isUsd1Direct ? 100 : 0.1;
        const secAmount = extraParams.multiDeploySecondaryAmount || defaultSecondary;
        const count = extraParams.multiDeployCount;

        showToast(`Deploying ${count} tokens...`, "info");
        deploymentService.createTokenMulti(
          deployParams,
          count,
          secAmount,
          (completed, total, successes) => {
            if (completed === 1 && successes === 1) {
              showToast(`Main deploy success! Launching ${total - 1} more...`, "success");
            }
          },
          (results) => {
            const successes = results.filter(r => r.success).length;
            if (successes === 0) {
              showToast(`All ${count} deploys failed: ${results[0]?.error}`, "error");
            } else if (successes < count) {
              showToast(`${successes}/${count} tokens deployed successfully`, "success");
            } else {
              showToast(`All ${count} tokens deployed successfully!`, "success");
            }
            setIsDeploying(false);
          }
        );
      } else {
        deploymentService.createToken(
          deployParams,
          (data) => {
            showToast(
              `Token $${symbol.trim()} Created Successfully!`,
              "success"
            );
            setIsDeploying(false);
          },
          (error) => {
            showToast(`Deployment Failed: ${error}`, "error");
            setIsDeploying(false);
          }
        );
      }
    } catch (error) {
      showToast(`Failed to connect to Token API: ${error}`, "error");
      setIsDeploying(false);
    }
  }, [activeWallet, name, symbol, uploadedImage, buyAmount, usd1BuyAmount, usd1Currency, selectedPlatform, selectedImageMode, website, twitter, deploymentService, showToast, generatePreview, getExtraDeployParams]);

  // Deploy with a specific amount (for preset buttons) - doesn't change the default buyAmount
  const handleDeployWithAmount = useCallback(async (amount: number, imageModeOverride?: "letter" | "sol" | "ascii") => {
    // Test mode - show preview instead of deploying (use ref for current value)
    if (testModeRef.current) {
      await generatePreview(amount);
      return;
    }

    // Validation
    if (!activeWallet) {
      showToast("Please import a wallet first! Click the Stack button (📚) in the top right.", "error");
      return;
    }

    if (!name || !symbol) {
      showToast("Please fill in Token Name and Symbol!", "error");
      return;
    }

    setIsDeploying(true);

    const effectiveImageMode = imageModeOverride || selectedImageMode;

    try {
      // Generate image if none uploaded, using selected image mode
      let imageToUse = imageModeOverride ? null : uploadedImage;
      if (!imageToUse) {
        const imageTypeMap = {
          'letter': 'Letter Image',
          'sol': 'SOL ASCII (Gradient)',
          'ascii': 'ASCII Art'
        };
        try {
          imageToUse = await generatePresetImage(
            imageTypeMap[effectiveImageMode],
            symbol.trim(),
            undefined,
            selectedPlatform === 'pump' ? 'Pump.fun' : undefined
          );
        } catch (imgError) {
          showToast(`Failed to generate image: ${imgError}`, "error");
          setIsDeploying(false);
          return;
        }
      }
      
      await deploymentService.connect();

      const extraParams = getExtraDeployParams();
      const deployParams = {
        platform: selectedPlatform,
        name: name.trim(),
        symbol: symbol.trim(),
        image: imageToUse,
        amount: amount,
        wallet: { publicKey: activeWallet.publicKey, privateKey: getWalletPrivateKey(activeWallet.publicKey) || activeWallet.privateKey },
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        ...extraParams,
      };

      if (extraParams.multiDeploy && extraParams.multiDeployCount && extraParams.multiDeployCount > 1) {
        const isUsd1Direct = selectedPlatform === 'usd1' && usd1Currency === 'USD1';
        const defaultSecondary = isUsd1Direct ? 100 : 0.1;
        const secAmount = extraParams.multiDeploySecondaryAmount || defaultSecondary;
        const count = extraParams.multiDeployCount;

        showToast(`Deploying ${count} tokens...`, "info");
        deploymentService.createTokenMulti(
          deployParams,
          count,
          secAmount,
          (completed, total, successes) => {
            if (completed === 1 && successes === 1) {
              showToast(`Main deploy success! Launching ${total - 1} more...`, "success");
            }
          },
          (results) => {
            const successes = results.filter(r => r.success).length;
            if (successes === 0) {
              showToast(`All ${count} deploys failed: ${results[0]?.error}`, "error");
            } else if (successes < count) {
              showToast(`${successes}/${count} tokens deployed successfully`, "success");
            } else {
              showToast(`All ${count} tokens deployed successfully!`, "success");
            }
            setIsDeploying(false);
          }
        );
      } else {
        deploymentService.createToken(
          deployParams,
          (data) => {
            showToast(
              `Token $${symbol.trim()} deployed with ${amount} SOL!`,
              "success"
            );
            setIsDeploying(false);
          },
          (error) => {
            showToast(`Deployment Failed: ${error}`, "error");
            setIsDeploying(false);
          }
        );
      }
    } catch (error) {
      showToast(`Failed to connect to Token API: ${error}`, "error");
      setIsDeploying(false);
    }
  }, [activeWallet, name, symbol, uploadedImage, selectedPlatform, selectedImageMode, usd1Currency, website, twitter, deploymentService, showToast, generatePreview, getExtraDeployParams]);

  // Bundle quick-buy: deploys with bundle forced ON, same amount on every wallet
  const handleBundleDeployWithAmount = useCallback(async (amount: number) => {
    if (testModeRef.current) {
      if (!name || !symbol) { showToast("Please fill in Token Name and Symbol!", "error"); return; }
      setIsDeploying(true);
      try {
        let imageToUse = uploadedImage;
        if (!imageToUse) {
          const imageTypeMap = { 'letter': 'Letter Image', 'sol': 'SOL ASCII (Gradient)', 'ascii': 'ASCII Art' };
          imageToUse = await generatePresetImage(imageTypeMap[selectedImageMode], symbol.trim(), undefined, selectedPlatform === 'pump' ? 'Pump.fun' : undefined);
        }
        // Build block0 wallets for preview
        const hasBlock0 = Object.values(block0SnipeWallets).some(c => c.enabled);
        const block0List = hasBlock0
          ? Object.entries(block0SnipeWallets)
              .filter(([pk, c]) => c.enabled && pk !== activeWallet?.publicKey)
              .slice(0, autoSellEnabled ? 4 : 5)
              .map(([pk]) => ({ publicKey: pk, amount }))
          : [];
        setPreviewData(buildPreviewData({
          imageToUse, amount,
          isBundle: block0List.length > 0,
          bundleWallets: block0List,
        }));
        setShowPreview(true);
      } catch (error) { showToast(`Failed to generate preview: ${error}`, "error"); }
      setIsDeploying(false);
      return;
    }
    if (!activeWallet) {
      showToast("Please import a wallet first!", "error");
      return;
    }
    if (!name || !symbol) {
      showToast("Please fill in Token Name and Symbol!", "error");
      return;
    }

    // Build bundle wallets — only uses explicitly selected Block 0 wallets
    // If none selected, deploy with dev wallet only (no bundle)
    const storedWallets = getStoredWallets();
    const maxWallets = autoSellEnabled ? 4 : 5;
    const hasConfiguredBlock0 = Object.values(block0SnipeWallets).some(c => c.enabled);

    let snipeWallets: SnipeWallet[] = [];
    if (hasConfiguredBlock0) {
      snipeWallets = Object.entries(block0SnipeWallets)
        .filter(([pubkey, config]) => config.enabled && pubkey !== activeWallet.publicKey)
        .slice(0, maxWallets)
        .map(([pubkey]) => {
          const stored = storedWallets.find(w => w.publicKey === pubkey);
          const privateKey = stored ? getWalletPrivateKey(pubkey) || '' : '';
          return { publicKey: pubkey, privateKey, amount };
        });
    }

    const usesBundle = snipeWallets.length > 0;

    setIsDeploying(true);
    try {
      let imageToUse = uploadedImage;
      if (!imageToUse) {
        const imageTypeMap = { 'letter': 'Letter Image', 'sol': 'SOL ASCII (Gradient)', 'ascii': 'ASCII Art' };
        try {
          imageToUse = await generatePresetImage(imageTypeMap[selectedImageMode], symbol.trim(), undefined, selectedPlatform === 'pump' ? 'Pump.fun' : undefined);
        } catch (imgError) {
          showToast(`Failed to generate image: ${imgError}`, "error");
          setIsDeploying(false);
          return;
        }
      }

      await deploymentService.connect();

      const extraParams = getExtraDeployParams();
      const deployParams = {
        platform: selectedPlatform,
        name: name.trim(),
        symbol: symbol.trim(),
        image: imageToUse,
        amount,
        wallet: { publicKey: activeWallet.publicKey, privateKey: getWalletPrivateKey(activeWallet.publicKey) || activeWallet.privateKey },
        website: website.trim() || undefined,
        twitter: twitter.trim() || undefined,
        ...extraParams,
        ...(usesBundle ? { bundleEnabled: true, snipeWallets } : {}),
      };

      deploymentService.createToken(
        deployParams,
        () => {
          showToast(usesBundle
            ? `Bundle deployed $${symbol.trim()} with ${amount} ${activeCurrencyLabel}/wallet!`
            : `Deployed $${symbol.trim()} with ${amount} ${activeCurrencyLabel}!`,
            "success");
          setIsDeploying(false);
        },
        (error) => {
          showToast(`Deploy failed: ${error}`, "error");
          setIsDeploying(false);
        }
      );
    } catch (error) {
      showToast(`Failed to connect to Token API: ${error}`, "error");
      setIsDeploying(false);
    }
  }, [activeWallet, name, symbol, uploadedImage, selectedPlatform, selectedImageMode, usd1Currency, website, twitter, deploymentService, showToast, buildPreviewData, getExtraDeployParams, block0SnipeWallets, autoSellEnabled, activeCurrencyLabel]);

  // Handle keybind on input fields (delegates to global handler logic)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only prevent default Enter to avoid form submission — actual deploy is handled by the global keybind listener
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  // Center crop image function
  const centerCropImage = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      // Don't set crossOrigin to avoid CORS issues
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Could not get canvas context');
          return;
        }
        
        // Determine the size of the square crop (use the smaller dimension)
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        
        // Calculate center crop coordinates
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;
        
        // Draw the center-cropped image
        ctx.drawImage(img, startX, startY, size, size, 0, 0, size, size);
        
        // Convert to data URL
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = (error) => {
        console.error('Image load error:', error);
        reject('Failed to load image');
      };
      
      img.src = imageUrl;
    });
  };
  
  // Generate symbol based on Ticker Mode
  const generateSymbol = (text: string, tickerMode: string): string => {
    const cleanText = text.trim();

    switch (tickerMode) {
      case 'Selected Text':
        // Remove spaces, uppercase, truncate at 13
        return cleanText.replace(/\s/g, '').toUpperCase().slice(0, 13);

      case 'Abbreviation': {
        // Take first letter of each word
        const words = cleanText.split(/\s+/);
        if (words.length > 1) {
          return words.map(w => w[0]).join('').toUpperCase().slice(0, 13);
        }
        return cleanText.replace(/\s/g, '').toUpperCase().slice(0, 13);
      }

      case 'First Word': {
        // Use only the first word
        const firstWord = cleanText.split(/\s+/)[0];
        return firstWord.slice(0, 13).toUpperCase();
      }

      case 'Custom': {
        // For custom, just use first 4 chars + random 3 digits
        const base = cleanText.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
        const random = Math.floor(100 + Math.random() * 900);
        return `${base}${random}`;
      }

      default:
        return cleanText.replace(/\s/g, '').toUpperCase().slice(0, 13);
    }
  };
  
  // Load preset amounts and buy amounts from localStorage (on mount + when settings change)
  useEffect(() => {
    const saved = storeGet('deployPresetAmounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) {
          setPresetAmounts(parsed);
          setTempPresets(parsed.map(String));
        }
      } catch (e) {
      }
    }
    const savedUsd1 = storeGet('deployPresetAmountsUSD1');
    if (savedUsd1) {
      try {
        const parsed = JSON.parse(savedUsd1);
        if (Array.isArray(parsed) && parsed.length === 5) {
          setUsd1PresetAmounts(parsed);
        }
      } catch (e) {
      }
    }
    // Also reload bundle presets
    const savedBundle = storeGet('deployBundlePresetAmounts');
    if (savedBundle) {
      try { const parsed = JSON.parse(savedBundle); if (Array.isArray(parsed) && parsed.length === 5) setBundlePresetAmounts(parsed); } catch {}
    }
    const savedBundleUsd1 = storeGet('deployBundlePresetAmountsUSD1');
    if (savedBundleUsd1) {
      try { const parsed = JSON.parse(savedBundleUsd1); if (Array.isArray(parsed) && parsed.length === 5) setUsd1BundlePresetAmounts(parsed); } catch {}
    }
    // Also reload buy amounts (may have been changed in Deploy Settings)
    const savedBuy = storeGet('nnn-buy-amount');
    if (savedBuy) { const v = parseFloat(savedBuy); if (v > 0) setBuyAmount(v); }
    const savedUsd1Buy = storeGet('nnn-usd1-buy-amount');
    if (savedUsd1Buy) { const v = parseFloat(savedUsd1Buy); if (v > 0) setUsd1BuyAmount(v); }
    // Reload block0 wallet selection (may have been changed in Deploy Settings)
    try { const v = storeGet(`nnn-block0-wallets-${getRegionKey()}`); if (v) setBlock0SnipeWallets(JSON.parse(v)); } catch {}
  }, [settingsVersion]);

  // Handle clear trigger - silently clear all fields (no toast, buy amount persists)
  useEffect(() => {
    if (clearTrigger && clearTrigger > 0) {
      setName("");
      onNameChange?.("");
      setSymbol("");
      setWebsite("");
      setTwitter("");
      setUploadedImage(null);
      setImageOptions([]);
      // Don't reset buyAmount - it persists
    }
  }, [clearTrigger]);
  
  // Handle deployed image from tweet / extension / Panel2
  useEffect(() => {
    if (deployedImageUrl && onImageDeployed) {
      const incoming = [...new Set((deployedImageOptions.length > 0 ? deployedImageOptions : [deployedImageUrl]).filter(u => !isVideoUrl(u)))];
      setImageOptions(prev => {
        const existing = new Set(prev);
        const merged = [...prev, ...incoming.filter(u => !existing.has(u))];
        return merged;
      });
      if (forceSelectImage) {
        // User explicitly clicked an image — always select it
        setUploadedImage(deployedImageUrl);
      } else {
        // Axiom search results — only auto-select if nothing is selected
        setUploadedImage(prev => prev || deployedImageUrl);
      }
      onImageDeployed();
    }
  }, [deployedImageUrl, deployedImageOptions, onImageDeployed, forceSelectImage]);

  // Auto-swap: when a video thumbnail is generated, replace the raw video URL in uploadedImage
  useEffect(() => {
    if (uploadedImage && isVideoUrl(uploadedImage) && videoThumbnails[uploadedImage]) {
      setUploadedImage(videoThumbnails[uploadedImage]);
    }
  }, [videoThumbnails, uploadedImage]);

  // Clear video thumbnail cache when image options change (new deploy)
  useEffect(() => {
    setVideoThumbnails({});
  }, [imageOptions]);

  // Handle deployed Twitter URL from Panel3 - 0MS DELAY (synchronous)
  useEffect(() => {
    if (deployedTwitterUrl && onTwitterDeployed) {
      setTwitter(deployedTwitterUrl);
      // Check whitelist — extract username from twitter URL (e.g. https://x.com/username/...)
      const urlMatch = deployedTwitterUrl.match(/x\.com\/([^/]+)/);
      if (urlMatch) checkWhitelistAndSwitchPlatform(urlMatch[1]);
      onTwitterDeployed(); // Clear the state immediately
    }
  }, [deployedTwitterUrl, onTwitterDeployed, checkWhitelistAndSwitchPlatform]);

  // Handle vamp data - fill all fields at once
  useEffect(() => {
    if (vampData && onVampApplied) {
      if (vampData.tokenName) {
        setName(vampData.tokenName);
        onNameChange?.(vampData.tokenName);
      }
      if (vampData.tokenSymbol) setSymbol(vampData.tokenSymbol);
      if (vampData.tokenImage) setUploadedImage(vampData.tokenImage);
      if (vampData.twitter) setTwitter(vampData.twitter);
      if (vampData.website) setWebsite(vampData.website);
      // Auto-select platform if provided
      if (vampData.platform) {
        const platformIndexMap: Record<string, number> = { pump: 0, bonk: 1, usd1: 2, bags: 3 };
        const idx = platformIndexMap[vampData.platform.toLowerCase()];
        if (idx !== undefined) setSelectedPlatformIndex(idx);
      }
      onVampApplied();
    }
  }, [vampData, onVampApplied, onNameChange]);

  // Ctrl+V paste image from clipboard
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Don't intercept paste in input/textarea fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setUploadedImage(reader.result);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Auto-fill on copy - listen for clipboard copy events and find tweet context
  useEffect(() => {
    if (!autoFillOnCopy) return;
    
    const handleCopy = (e: ClipboardEvent) => {
      // Get the selected text directly from the selection (works in all browsers)
      const selection = window.getSelection();
      const text = selection?.toString();
      
      if (text && text.trim()) {
        const trimmedText = text.trim();

            // Set the name field
            setName(trimmedText);
            onNameChange?.(trimmedText);
            
            // Auto-generate ticker if enabled
            if (autoGenerateTicker) {
              let ticker: string;
              ticker = trimmedText.replace(/\s/g, '').toUpperCase().slice(0, 13);
              setSymbol(ticker);
            }
            
            // Helper function to check if text exists in a tweet (including nested tweets)
            const textMatchesTweet = (tweet: Tweet, searchText: string): boolean => {
              const lowerSearch = searchText.toLowerCase();
              // Check main tweet text
              if (tweet.text && tweet.text.toLowerCase().includes(lowerSearch)) return true;
              // Check quoted tweet text (for retweets/quotes where main text might be empty)
              if (tweet.quotedTweet?.text && tweet.quotedTweet.text.toLowerCase().includes(lowerSearch)) return true;
              // Check replied-to tweet text
              if (tweet.repliedToTweet?.text && tweet.repliedToTweet.text.toLowerCase().includes(lowerSearch)) return true;
              return false;
            };
            
            // Find the tweet that contains this text (search main text, quoted text, and replied text)
            const matchingTweet = tweets.find(tweet => textMatchesTweet(tweet, trimmedText));

            if (matchingTweet) {

              // Fill Twitter URL
              const twitterUrl = buildTweetUrl(matchingTweet.username, matchingTweet.twitterStatusId);
              setTwitter(twitterUrl);

              // Collect ALL images (same as DEPLOY button), excluding videos
              const allImages = collectAllTweetImages(matchingTweet).filter(u => !isVideoUrl(u));
              if (allImages.length > 0) {
                setImageOptions(allImages);
                setUploadedImage(allImages[0]);
              }
            } else {
            }
          }
    };
    
    // Listen for copy events
    document.addEventListener('copy', handleCopy as EventListener);
    
    return () => {
      document.removeEventListener('copy', handleCopy as EventListener);
    };
  }, [autoFillOnCopy, autoGenerateTicker, tweets]);

  // Double-click to auto-fill (and optionally deploy) - triggered on double-click
  useEffect(() => {
    // Check both autoFillOnCopy and the insta-deploy double-click setting
    const doubleClickDeployEnabled = typeof window !== 'undefined' && storeGet('insta-deploy-double-click') === 'true';
    if (!autoFillOnCopy && !doubleClickDeployEnabled) return;

    const handleDoubleClick = (e: MouseEvent) => {
      // Only trigger from the tweet feed — ignore clicks inside deploy panel, token search, modals, etc.
      const target = e.target as HTMLElement;
      if (target.closest('[data-panel-deploy]') || target.closest('[data-panel-search]') || target.closest('[role="dialog"]')) return;

      // Small delay to let the browser select the word
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString();

        if (text && text.trim()) {
          const trimmedText = text.trim();

          // Set the name field
          setName(trimmedText);
          onNameChange?.(trimmedText);
          onTokenSearch?.(trimmedText);

          // Auto-focus name input (same as Deploy button click)
          setTimeout(() => {
            const nameInput = document.querySelector('input[placeholder="Token name"]') as HTMLInputElement;
            if (nameInput) { nameInput.focus(); nameInput.select(); }
          }, 0);

          // Auto-generate ticker if enabled
          if (autoGenerateTicker) {
            const ticker = trimmedText.replace(/\s/g, '').toUpperCase().slice(0, 13);
            setSymbol(ticker);
          }
          
          // Helper function to check if text exists in a tweet
          const textMatchesTweet = (tweet: Tweet, searchText: string): boolean => {
            const lowerSearch = searchText.toLowerCase();
            if (tweet.text && tweet.text.toLowerCase().includes(lowerSearch)) return true;
            if (tweet.quotedTweet?.text && tweet.quotedTweet.text.toLowerCase().includes(lowerSearch)) return true;
            if (tweet.repliedToTweet?.text && tweet.repliedToTweet.text.toLowerCase().includes(lowerSearch)) return true;
            return false;
          };
          
          // Find the matching tweet
          const matchingTweet = tweets.find(tweet => textMatchesTweet(tweet, trimmedText));

          if (matchingTweet) {

            // Check whitelist — auto-switch platform if username is whitelisted
            checkWhitelistAndSwitchPlatform(matchingTweet.username);

            // Fill Twitter URL
            const twitterUrl = buildTweetUrl(matchingTweet.username, matchingTweet.twitterStatusId);
            setTwitter(twitterUrl);

            // Collect ALL images (same as DEPLOY button) + matching folder images, excluding videos
            const allImages = collectAllTweetImages(matchingTweet).filter(u => !isVideoUrl(u));
            // Add matching folder images
            const lowerName = trimmedText.toLowerCase();
            const matchingFolderImgs = browserImages
              .filter(img => img.nameWithoutExt.toLowerCase().includes(lowerName))
              .map(img => `/api/local-images/serve?file=${encodeURIComponent(img.filename)}`);
            const combined = [...allImages, ...matchingFolderImgs];
            if (combined.length > 0) {
              setImageOptions(combined);
              setUploadedImage(combined[0]);
            }
          } else {
            // No matching tweet — still show matching folder images
            const lowerName = trimmedText.toLowerCase();
            const matchingFolderImgs = browserImages
              .filter(img => img.nameWithoutExt.toLowerCase().includes(lowerName))
              .map(img => `/api/local-images/serve?file=${encodeURIComponent(img.filename)}`);
            if (matchingFolderImgs.length > 0) {
              setImageOptions(matchingFolderImgs);
              setUploadedImage(matchingFolderImgs[0]);
            }
          }
          // If double-click-to-deploy is enabled, flag for deploy after state updates
          if (doubleClickDeployEnabled) {
            pendingDeployRef.current = true;
          }
        }
      }, 10);
    };

    document.addEventListener('dblclick', handleDoubleClick);

    return () => {
      document.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [autoFillOnCopy, autoGenerateTicker, tweets, onTokenSearch, browserImages, checkWhitelistAndSwitchPlatform]);

  // Fire pending deploy once name+symbol state has updated (double-click-to-deploy + saved token load)
  useEffect(() => {
    if (pendingDeployRef.current && name && symbol) {
      pendingDeployRef.current = false;
      handleDeploy();
    }
  }, [name, symbol, handleDeploy]);

  // Fire pending quick deploy (LETTER/SOL/ASCII buttons) after image mode state update
  useEffect(() => {
    if (pendingQuickDeployRef.current) {
      const { amount, imageMode } = pendingQuickDeployRef.current;
      pendingQuickDeployRef.current = null;
      handleDeployWithAmount(amount, imageMode);
    }
  }, [selectedImageMode, handleDeployWithAmount]);

  // Global deploy keybind handler — reads from configurable keybind (e.g. "Enter", "Ctrl + X")
  useEffect(() => {
    const matchesKeybind = (e: KeyboardEvent, bind: string): boolean => {
      if (!bind) return false;
      const parts = bind.split(/\s*\+\s*/);
      const key = parts[parts.length - 1];
      const needCtrl = parts.includes('Ctrl');
      const needAlt = parts.includes('Alt');
      const needShift = parts.includes('Shift');
      const needMeta = parts.includes('Meta');
      if (needCtrl !== e.ctrlKey) return false;
      if (needAlt !== e.altKey) return false;
      if (needShift !== e.shiftKey) return false;
      if (needMeta !== e.metaKey) return false;
      const pressedKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      return pressedKey === key;
    };

    const handleGlobalKeybind = (e: KeyboardEvent) => {
      if (!matchesKeybind(e, deployKeybind)) return;
      if (isDeploying) return;
      if (!name.trim() || !symbol.trim()) return;
      if (!uploadedImage) return;
      if (!activeWallet) return;
      e.preventDefault();
      handleDeploy();
    };

    document.addEventListener('keydown', handleGlobalKeybind);
    return () => document.removeEventListener('keydown', handleGlobalKeybind);
  }, [name, symbol, uploadedImage, activeWallet, isDeploying, handleDeploy, deployKeybind]);
  
  // Apply preset when triggered - INSTANT BACKGROUND DEPLOY (or preview in test mode)
  useEffect(() => {
    if (presetTrigger && onPresetApplied) {
      
      // Build the token data from preset (don't update visible form)
      const baseText = presetTrigger.selectedText || '';
      const tokenName = `${presetTrigger.namePrefix}${baseText}${presetTrigger.nameSuffix}`.trim();
      
      // Generate symbol — use override ticker if provided, otherwise generate from tickerMode
      const tokenSymbol = presetTrigger.overrideTicker || generateSymbol(baseText, presetTrigger.tickerMode);
      
      // Get platform
      const platformMap: { [key: string]: "pump" | "bonk" | "usd1" | "bags" } = {
        'Pump': 'pump',
        'Pump.fun': 'pump',
        'Raydium': 'bonk',
        'Jupiter': 'usd1',
        'Binance': 'bonk',
        'USD1': 'usd1',
        'BONK': 'bonk',
        'Meteora': 'bags',
      };
      const deployPlatform = presetTrigger.deployPlatform !== 'Use Account Default' 
        ? platformMap[presetTrigger.deployPlatform] || selectedPlatform
        : selectedPlatform;
      
      // Handle tweet image and deploy instantly in background (or preview in test mode)
      const instantDeploy = async () => {
        if (!tokenName || !tokenSymbol) {
          showToast("Could not generate token name from selected text!", "error");
          onPresetApplied();
          return;
        }
        
        // For preset triggers (Ctrl+X), DON'T use the GUI's uploaded image - use tweet image or generate fresh
        let imageToUse: string | null = null;
        
        // Use tweet image directly if available (avoid CORS issues with cropping)
        if (presetTrigger.tweetImageUrl && presetTrigger.imageType === 'Image in Post') {
          imageToUse = presetTrigger.tweetImageUrl;
        } 
        // Generate image for non-"Image in Post" types
        else if (presetTrigger.imageType && presetTrigger.imageType !== 'Image in Post') {
          try {
            imageToUse = await generatePresetImage(
              presetTrigger.imageType,
              baseText,
              presetTrigger.customImageUrl,
              presetTrigger.deployPlatform
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Image generation failed:', errorMsg);
            showToast(`Image generation failed: ${errorMsg}`, "error");
            onPresetApplied();
            return;
          }
        }
        
        // Fallback: Generate ASCII art if no image available
        if (!imageToUse) {
          try {
            imageToUse = await generatePresetImage(
              'ASCII Art',
              baseText || tokenSymbol,
              undefined,
              presetTrigger.deployPlatform
            );
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ ASCII fallback failed:', errorMsg);
            showToast(`Image generation failed: ${errorMsg}`, "error");
            onPresetApplied();
            return;
          }
        }
        
        // TEST MODE - Show preview instead of deploying
        if (testModeRef.current) {
          const deployAmount = ((selectedPlatform === 'usd1' && usd1Currency === 'USD1') ? usd1BuyAmount : buyAmount) || 0.01;
          setPreviewData(buildPreviewData({
            tokenName, tokenSymbol, imageToUse,
            amount: deployAmount,
            imageSource: presetTrigger.imageType || getImageSourceLabel(imageToUse),
            tweetLink: presetTrigger.tweetLink,
          }));
          setShowPreview(true);
          onPresetApplied();
          return;
        }
        
        // REAL MODE - Check wallet and deploy
        if (!activeWallet) {
          showToast("Please import a wallet first!", "error");
          onPresetApplied();
          return;
        }
        
        // Deploy instantly in background (no delay toast)
        setIsDeploying(true);
        
        try {
          await deploymentService.connect();

          const extraParams = getExtraDeployParams();
          const deployAmount = ((selectedPlatform === 'usd1' && usd1Currency === 'USD1') ? usd1BuyAmount : buyAmount) || 0.01;
          const deployParams = {
            platform: deployPlatform as "pump" | "bonk" | "usd1" | "bags",
            name: tokenName,
            symbol: tokenSymbol,
            image: imageToUse,
            amount: deployAmount,
            wallet: { publicKey: activeWallet.publicKey, privateKey: getWalletPrivateKey(activeWallet.publicKey) || activeWallet.privateKey },
            website: website.trim() || undefined,
            twitter: presetTrigger.tweetLink || twitter.trim() || undefined,
            ...extraParams,
          };

          if (extraParams.multiDeploy && extraParams.multiDeployCount && extraParams.multiDeployCount > 1) {
            const isUsd1Direct = selectedPlatform === 'usd1' && usd1Currency === 'USD1';
            const defaultSecondary = isUsd1Direct ? 100 : 0.1;
            const secAmount = extraParams.multiDeploySecondaryAmount || defaultSecondary;
            const count = extraParams.multiDeployCount;

            showToast(`Deploying ${count} tokens...`, "info");
            deploymentService.createTokenMulti(
              deployParams,
              count,
              secAmount,
              () => {},
              (results) => {
                const successes = results.filter(r => r.success).length;
                if (successes === 0) {
                  showToast(`All ${count} deploys failed: ${results[0]?.error}`, "error");
                } else {
                  showToast(`${successes}/${count} tokens deployed!`, "success");
                }
                setIsDeploying(false);
              }
            );
          } else {
            deploymentService.createToken(
              deployParams,
              (data) => {
                showToast(`Token $${tokenSymbol} Created Successfully!`, "success");
                setIsDeploying(false);
              },
              (error) => {
                showToast(`Deployment Failed: ${error}`, "error");
                setIsDeploying(false);
              }
            );
          }
        } catch (error) {
          showToast(`Failed to connect to Token API: ${error}`, "error");
          setIsDeploying(false);
        }
      };
      
      instantDeploy();
      
      // Clear the trigger
      onPresetApplied();
    }
  }, [presetTrigger]);

  // Google image search handlers
  const handleGoogleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsGoogleSearching(true);
    try {
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      const imgs = data.images || data.results || (Array.isArray(data) ? data : []);
      if (Array.isArray(imgs) && imgs.length > 0) {
        setGoogleResults(
          imgs.map((r: any) => ({
            imageUrl: r.imageUrl || r.url || r.image || (typeof r === 'string' ? r : ''),
            thumbnailUrl: r.thumbnailUrl || r.thumbnail,
            title: r.title,
          })).filter((r: any) => r.imageUrl)
        );
      } else {
        setGoogleResults([]);
      }
    } catch {
      setGoogleResults([]);
    } finally {
      setIsGoogleSearching(false);
    }
  }, []);

  const selectGoogleImage = useCallback(async (url: string, index: number) => {
    setGoogleLoadingIndex(index);
    try {
      // Fetch via our server-side proxy (no CORS issues)
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const blob = await res.blob();
        // The proxy returns a ~75-byte transparent pixel on failure, so check size
        if (blob.size > 500 && blob.type.startsWith('image')) {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setUploadedImage(dataUrl);
          setShowGoogleSearch(false);
          setGoogleLoadingIndex(null);
          return;
        }
      }
      // Proxy failed — just use the raw URL directly
      // It'll be proxied again when displayed, and for deploy the service can fetch it
      setUploadedImage(url);
      setShowGoogleSearch(false);
      setGoogleLoadingIndex(null);
    } catch {
      // Last resort — still set the URL so the user gets something
      setUploadedImage(url);
      setShowGoogleSearch(false);
      setGoogleLoadingIndex(null);
    }
  }, []);

  // Close wallet dropdown on click outside
  useEffect(() => {
    if (!showWalletDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(e.target as Node)) {
        setShowWalletDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showWalletDropdown]);

  // Close Google popdown on click outside
  useEffect(() => {
    if (!showGoogleSearch) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (googleSearchRef.current && !googleSearchRef.current.contains(e.target as Node)) {
        setShowGoogleSearch(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGoogleSearch]);

  // Close bundle popup on click outside (exclude the button itself to avoid race condition)
  useEffect(() => {
    if (!showBundlePopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        bundlePopupRef.current && !bundlePopupRef.current.contains(target) &&
        bundleButtonRef.current && !bundleButtonRef.current.contains(target)
      ) {
        setShowBundlePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBundlePopup]);

  // Close multi popup on click outside (exclude the button itself to avoid race condition)
  useEffect(() => {
    if (!showMultiPopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        multiPopupRef.current && !multiPopupRef.current.contains(target) &&
        multiButtonRef.current && !multiButtonRef.current.contains(target)
      ) {
        setShowMultiPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMultiPopup]);

  // Focus google search input when opened
  useEffect(() => {
    if (showGoogleSearch && googleInputRef.current) {
      googleInputRef.current.focus();
    }
  }, [showGoogleSearch]);

  return (
    <div
      data-panel-deploy
      className={`h-full ${variant === 'launchblitz' ? 'bg-[#0a0a0b] lb-deploy' : `${theme.panel1ContentBg} glass-panel`} flex flex-col relative ${isDragging && !editMode ? 'ring-4 ring-blue-500' : ''}`}
      onDragEnter={!editMode ? handleDragEnter : undefined}
      onDragOver={!editMode ? handleDragOver : undefined}
      onDragLeave={!editMode ? handleDragLeave : undefined}
      onDrop={!editMode ? handleDrop : undefined}
    >
      {/* Toast Container - Header bar, right of center buttons */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1 pointer-events-none" style={{ paddingTop: '2px' }}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
              duration={2000}
            />
          </div>
        ))}
      </div>
      {/* Header Row */}
      <div className={`${variant === 'launchblitz' ? 'px-3 py-2 border-b border-white/[0.06] bg-transparent' : 'panel-header'} flex items-center gap-2`}>
        {variant !== 'launchblitz' && <span className="section-label">Deploy</span>}

        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-white/20 hover:text-red-400 px-1.5 py-0.5 rounded hover:bg-red-500/10 btn-lift text-[10px]"
        >
          <Trash2 size={10} />
          <span>Clear</span>
        </button>

        <button
          onClick={handleSaveToken}
          className="flex items-center gap-1 text-white/20 hover:text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-500/10 btn-lift text-[10px]"
          title="Save token for later"
        >
          <svg className="w-[10px] h-[10px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Save</span>
        </button>

        <div className="flex-1" />

        {/* Wallet Dropdown */}
        <div className="relative" ref={walletDropdownRef}>
          <button
            onClick={() => setShowWalletDropdown(!showWalletDropdown)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono transition-colors ${
              activeWallet
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/50'
            }`}
          >
            {activeWallet ? (
              <svg className="w-[10px] h-[10px] text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                <line x1="6" y1="17" x2="18" y2="17" />
                <line x1="9" y1="21" x2="15" y2="21" />
                <line x1="9" y1="17" x2="9" y2="21" />
                <line x1="15" y1="17" x2="15" y2="21" />
              </svg>
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
            )}
            {activeWallet
              ? `${activeWallet.publicKey.slice(0, 4)}...${activeWallet.publicKey.slice(-4)}`
              : 'None'}
            <svg className={`w-2.5 h-2.5 transition-transform ${showWalletDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showWalletDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-black/95 backdrop-blur-md border border-white/[0.1] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.5)] overflow-hidden">
              {wallets.length === 0 ? (
                <div className="px-3 py-2.5 text-white/30 text-[10px] text-center">
                  No wallets imported
                </div>
              ) : (
                wallets.map((w) => {
                  const isSelected = activeWallet?.id === w.id;
                  const isBlock0 = !isSelected && block0SnipeWallets[w.publicKey]?.enabled;
                  const isSnipeActive = !isSelected && (isBlock0 || (bundleEnabled && bundleSnipeWallets[w.publicKey]?.enabled));
                  const dimmed = !isSelected && !isSnipeActive;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        if (!isSelected) {
                          onWalletSelect?.(w);
                          setBundleEnabled(false);
                          setBundleSnipeWallets({});
                        }
                        setShowWalletDropdown(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : dimmed
                            ? 'text-white/25 hover:bg-white/[0.04] hover:text-white/40'
                            : 'text-white/60 hover:bg-white/[0.06] hover:text-white/80'
                      }`}
                    >
                      {isSelected ? (
                        <svg className="w-[11px] h-[11px] flex-shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                          <line x1="6" y1="17" x2="18" y2="17" />
                          <line x1="9" y1="21" x2="15" y2="21" />
                          <line x1="9" y1="17" x2="9" y2="21" />
                          <line x1="15" y1="17" x2="15" y2="21" />
                        </svg>
                      ) : (
                        <svg className={`w-[11px] h-[11px] flex-shrink-0 ${isSnipeActive ? 'text-amber-400/80' : 'text-white/20'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="8" />
                          <line x1="12" y1="2" x2="12" y2="6" />
                          <line x1="12" y1="18" x2="12" y2="22" />
                          <line x1="2" y1="12" x2="6" y2="12" />
                          <line x1="18" y1="12" x2="22" y2="12" />
                        </svg>
                      )}
                      <span className="text-[10px] font-mono truncate">{w.publicKey.slice(0, 6)}...{w.publicKey.slice(-4)}</span>
                      <span className={`text-[9px] ml-auto flex-shrink-0 ${dimmed ? 'text-white/10' : 'text-white/20'}`}>{w.balance.toFixed(3)} SOL</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {savedTokens.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-white/[0.04] overflow-x-auto scrollbar-hide bg-white/[0.01]">
          <span className="text-[8px] text-white/15 uppercase tracking-wider flex-shrink-0 mr-1">Saved</span>
          {savedTokens.map((token) => (
            <div key={token.id} className="flex items-center gap-1 flex-shrink-0 group">
              <button
                onClick={() => handleLoadSavedToken(token)}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] hover:bg-blue-500/15 border border-white/[0.06] hover:border-blue-500/30 transition-colors"
                title={`Deploy ${token.name} ($${token.symbol})`}
              >
                {token.image && <img src={token.image.startsWith('data:') ? token.image : `/api/proxy-image?url=${encodeURIComponent(token.image)}`} alt="" className="w-3.5 h-3.5 rounded object-cover" />}
                <span className="text-[10px] text-white/60 font-semibold">{token.symbol}</span>
              </button>
              <button
                onClick={() => handleRemoveSavedToken(token.id)}
                className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all p-0.5"
                title="Remove"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
          <button
            onClick={handleClearSavedTokens}
            className="text-white/15 hover:text-red-400 transition-colors flex-shrink-0 ml-auto pl-1"
            title="Clear all saved tokens"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}

      {/* Content Area */}
      <div className={`flex-1 px-3 py-2 overflow-auto ${variant === 'launchblitz' ? 'bg-transparent' : theme.panel1ContentBg}`}>
        <div className={`flex flex-col ${variant === 'launchblitz' ? 'gap-3' : 'gap-2'}`}>
          {/* NAME + SYMBOL row */}
          <div>
            {variant !== 'launchblitz' && (
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="section-label">Name</span>
                  <span className="text-[9px] text-white/20">{name.length}/32</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="section-label">Symbol</span>
                  <span className="text-[9px] text-white/20">{symbol.length}/13</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAutoFillOnCopy(!autoFillOnCopy)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                    autoFillOnCopy
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/[0.04] text-white/25 border border-white/[0.06] hover:text-white/40'
                  }`}
                >
                  Auto-fill
                </button>
                <button
                  onClick={() => setAutoGenerateTicker(!autoGenerateTicker)}
                  className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                    autoGenerateTicker
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-white/[0.04] text-white/25 border border-white/[0.06] hover:text-white/40'
                  }`}
                >
                  Auto-gen
                </button>
              </div>
            </div>
            )}
            <div className={variant === 'launchblitz' ? 'grid grid-cols-[65fr_35fr] gap-3' : 'flex gap-1.5'}>
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  maxLength={32}
                  placeholder={variant === 'launchblitz' ? 'Coin name' : 'Token name'}
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full ${variant === 'launchblitz' ? 'bg-black/60 text-white' : `${theme.inputBg} ${theme.textPrimary}`} px-3 py-1.5 ${variant === 'launchblitz' ? 'pr-16' : 'pr-6'} rounded border ${variant === 'launchblitz' ? 'border-white/[0.10]' : theme.inputBorder} text-sm focus:outline-none ${variant === 'launchblitz' ? 'focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15 shadow-xs' : 'input-premium'}`}
                />
                {variant === 'launchblitz' ? (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-[11px] text-white/25 font-medium">{name.length}/32</span>
                    {name && (
                      <button type="button" tabIndex={-1} onClick={() => { handleNameChange(""); }} className="p-0.5 text-white/20 hover:text-white/50 transition-colors">
                        <XIcon size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  name && (
                    <button type="button" tabIndex={-1} onClick={() => { handleNameChange(""); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/20 hover:text-white/50 transition-colors">
                      <XIcon size={11} />
                    </button>
                  )
                )}
              </div>
              <div className={`relative ${variant === 'launchblitz' ? 'min-w-0' : 'w-[100px]'}`}>
                <input
                  type="text"
                  maxLength={13}
                  placeholder="Ticker"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`w-full ${variant === 'launchblitz' ? 'bg-black/60 text-white' : `${theme.inputBg} ${theme.textPrimary}`} px-3 py-1.5 ${variant === 'launchblitz' ? 'pr-16' : 'pr-6'} rounded border ${variant === 'launchblitz' ? 'border-white/[0.10]' : theme.inputBorder} text-sm font-medium focus:outline-none ${variant === 'launchblitz' ? 'focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15 shadow-xs placeholder-white/30' : 'focus:border-white/15 placeholder-white/15'} uppercase`}
                />
                {variant === 'launchblitz' ? (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                    <span className="text-[11px] text-white/25 font-medium">{symbol.length}/13</span>
                    {symbol && (
                      <button type="button" tabIndex={-1} onClick={() => { setSymbol(""); if (!name.trim()) { setImageOptions([]); setUploadedImage(null); } }} className="p-0.5 text-white/20 hover:text-white/50 transition-colors">
                        <XIcon size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  symbol && (
                    <button type="button" tabIndex={-1} onClick={() => { setSymbol(""); if (!name.trim()) { setImageOptions([]); setUploadedImage(null); } }} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/20 hover:text-white/50 transition-colors">
                      <XIcon size={11} />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* WEBSITE + TWITTER */}
          <div className={variant === 'launchblitz' ? 'flex flex-col gap-4' : 'flex gap-1.5'}>
            {/* Twitter first in LB layout */}
            {variant === 'launchblitz' && (
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-black/60 text-white px-3 py-1.5 rounded border border-white/[0.10] text-sm focus:outline-none focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15 shadow-xs placeholder-white/30"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {variant !== 'launchblitz' && <span className="section-label mb-0.5 block">Website</span>}
              <input
                type="text"
                placeholder={variant === 'launchblitz' ? 'Website' : 'https://example.com'}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full ${variant === 'launchblitz' ? 'bg-black/60 text-white px-3 py-1.5 rounded border border-white/[0.10] text-sm focus:outline-none focus:border-blue-500/50 focus:ring-[3px] focus:ring-blue-500/15 shadow-xs placeholder-white/30' : `${theme.inputBg} ${theme.textPrimary} px-2.5 py-1.5 rounded-md border ${theme.inputBorder} text-[12px] focus:outline-none input-premium`}`}
              />
            </div>
            {variant !== 'launchblitz' && (
            <div className="flex-1 min-w-0">
              <span className="section-label mb-0.5 block">Twitter</span>
              <input
                type="text"
                placeholder="https://x.com/..."
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`w-full ${theme.inputBg} ${theme.textPrimary} px-2.5 py-1.5 rounded-md border ${theme.inputBorder} text-[12px] focus:outline-none input-premium`}
              />
            </div>
            )}
          </div>

          {/* Select Image */}
          <div>
          <span className="section-label mb-1.5 block">{variant === 'launchblitz' ? 'Image Studio' : 'Select Image'}</span>
          <div
            className="flex items-center gap-2 justify-center flex-wrap"
            onDragEnter={!editMode ? handleDragEnter : undefined}
            onDragOver={!editMode ? handleDragOver : undefined}
            onDragLeave={!editMode ? handleDragLeave : undefined}
            onDrop={!editMode ? handleDrop : undefined}
          >
            {/* Show all image options from deploy */}
            {imageOptions.length > 0 ? (
              imageOptions.map((imgUrl, idx) => {
                const isSelected = uploadedImage === imgUrl;
                return (
                  <button
                    key={idx}
                    onClick={() => setUploadedImage(imgUrl)}
                    className={`relative group w-14 h-14 rounded overflow-hidden flex-shrink-0 transition-all ${
                      isSelected
                        ? variant === 'launchblitz'
                          ? 'ring-2 ring-blue-500 border border-blue-500'
                          : 'ring-2 ring-green-500 border border-green-500'
                        : 'border border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <img
                      src={imgUrl.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(imgUrl)}` : imgUrl}
                      alt={`Option ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className={`absolute top-0.5 right-0.5 w-4 h-4 ${variant === 'launchblitz' ? 'bg-blue-500' : 'bg-green-500'} rounded-full flex items-center justify-center`}>
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {/* Hover X to remove */}
                    <div
                      className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/60 hover:bg-red-600/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uploadedImage === imgUrl) setUploadedImage(null);
                        setImageOptions(prev => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </button>
                );
              })
            ) : uploadedImage ? (
              <div className="relative group w-14 h-14 rounded overflow-hidden border border-white/[0.08] flex-shrink-0">
                <img
                  src={uploadedImage.startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(uploadedImage)}` : uploadedImage}
                  alt="Token"
                  className="w-full h-full object-cover"
                />
                {/* Hover overlay with crop + remove */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => setShowCropModal(true)}
                    className="p-1.5 bg-white/[0.12] hover:bg-white/20 rounded-md transition-colors"
                    title="Crop"
                  >
                    <Crop size={12} className="text-white" />
                  </button>
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="p-1.5 bg-white/[0.12] hover:bg-red-600/80 rounded-md transition-colors"
                    title="Remove"
                  >
                    <XIcon size={12} className="text-white" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Add / Upload button */}
            <button
              onClick={() => document.getElementById('panel1-file-input')?.click()}
              className={`w-14 h-14 rounded border border-dashed flex items-center justify-center transition-colors flex-shrink-0 ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/15'
                  : 'border-white/[0.08] hover:border-white/15 bg-white/[0.04]'
              }`}
              title="Upload image"
            >
              <Plus size={20} className="text-white/30" />
            </button>
            <input
              id="panel1-file-input"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setUploadedImage(ev.target?.result as string);
                  reader.readAsDataURL(file);
                }
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {/* Image action buttons row */}
          {variant === 'launchblitz' ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { if (uploadedImage) setShowCropModal(true); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                    uploadedImage ? 'border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white' : 'border-white/[0.08] bg-white/[0.02] text-white/30 cursor-default'
                  }`}
                >
                  <Crop size={13} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { setSelectedImageMode("ascii"); setUploadedImage(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white text-[12px] font-medium transition-colors"
                >
                  <span className="font-mono">&gt;_</span>
                  <span>ASCII</span>
                </button>
                <button
                  onClick={() => { setSelectedImageMode("letter"); setUploadedImage(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white text-[12px] font-medium transition-colors"
                >
                  <span className="font-serif font-bold">T</span>
                  <span>Letter</span>
                </button>
              </div>
              <button
                onClick={() => setShowGoogleSearch(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                  showGoogleSearch ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-white/[0.12] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5"/><path d="M3 9h18M9 3v18" strokeWidth="1.5"/></svg>
                <span>Dev Panel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1">
              <button
                onClick={() => { if (uploadedImage) setShowCropModal(true); }}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors ${
                  uploadedImage ? 'text-white/40 hover:text-white hover:bg-white/[0.08]' : 'text-white/25 cursor-default'
                }`}
              >
                <Crop size={11} />
                <span>Edit</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                      const imageType = item.types.find(t => t.startsWith('image/'));
                      if (imageType) {
                        const blob = await item.getType(imageType);
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') setUploadedImage(reader.result);
                        };
                        reader.readAsDataURL(blob);
                        return;
                      }
                    }
                    const text = await navigator.clipboard.readText();
                    const trimmed = text.trim();
                    if (trimmed.startsWith('http') || trimmed.startsWith('data:image')) {
                      setUploadedImage(trimmed);
                    }
                  } catch {}
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <ClipboardPaste size={11} />
                <span>Paste</span>
              </button>
              <button
                onClick={() => document.getElementById('panel1-file-input')?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <ImageLucide size={11} />
                <span>Images</span>
              </button>
              <button
                onClick={() => {
                  setSelectedImageMode("ascii");
                  setUploadedImage(null);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <span className="font-mono">&gt;_</span>
                <span>ASCII</span>
              </button>
            </div>
          )}
          </div>

          {/* Platform */}
          <div>
            {variant !== 'launchblitz' && <span className="section-label mb-1 block text-center">Platform</span>}
            {variant === 'launchblitz' ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {logos.map((logo, i) => {
                  const isActive = selectedPlatformIndex === i;
                  const platformColors: Record<number, string> = {
                    0: isActive ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : '',
                    1: isActive ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : '',
                    2: isActive ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : '',
                    3: isActive ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : '',
                    4: isActive ? 'bg-purple-500/20 border-purple-500/40 text-purple-400' : '',
                    5: isActive ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : '',
                  };
                  return (
                    <button
                      key={i}
                      onClick={() => handleManualPlatformChange(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                        isActive
                          ? platformColors[i]
                          : 'border-white/[0.10] bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70'
                      }`}
                    >
                      <Image src={logo.src} alt={logo.alt} width={16} height={16} className="object-contain" />
                      <span>{logo.alt}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1">
                {logos.map((logo, i) => (
                  <button
                    key={i}
                    onClick={() => handleManualPlatformChange(i)}
                    className={`w-8 h-8 rounded flex items-center justify-center border transition-colors overflow-hidden ${
                      selectedPlatformIndex === i
                        ? 'border-blue-500 bg-blue-500/15'
                        : 'border-white/[0.06] bg-white/[0.04] hover:border-white/15'
                    }`}
                  >
                    <Image
                      src={logo.src}
                      alt={logo.alt}
                      width={22}
                      height={22}
                      className="object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
            {/* USD1/SOL currency toggle — only for USD1 platform */}
            {selectedPlatform === 'usd1' && (
              <div className="flex justify-center mt-1">
                <div className="flex items-center bg-white/[0.04] rounded-md border border-white/[0.06] overflow-hidden">
                  <button
                    onClick={() => setUsd1Currency("USD1")}
                    className={`px-3 py-1 text-[10px] font-semibold transition-colors ${
                      usd1Currency === 'USD1'
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    USD1
                  </button>
                  <button
                    onClick={() => setUsd1Currency("SOL")}
                    className={`px-3 py-1 text-[10px] font-semibold transition-colors ${
                      usd1Currency === 'SOL'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    SOL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* === Advanced Deploy Options — Button Toggles === */}
          <div className="relative">
            {variant === 'launchblitz' ? (
              <div className="grid grid-cols-3 gap-1.5">
                {/* Turbo */}
                <button
                  onClick={() => setTurboModeEnabled(prev => !prev)}
                  className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors ${
                    turboModeEnabled
                      ? 'border-white/[0.15] bg-white/[0.06] text-white'
                      : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${turboModeEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                    {turboModeEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="truncate">Turbo</span>
                </button>

                {/* Cashback — Pump only */}
                {selectedPlatform === 'pump' && (
                  <button
                    onClick={() => setCashbackEnabled(prev => !prev)}
                    className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors ${
                      cashbackEnabled
                        ? 'border-white/[0.15] bg-white/[0.06] text-white'
                        : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${cashbackEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                      {cashbackEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate">Cashback</span>
                  </button>
                )}

                {/* Bonkers — Bonk/USD1 only */}
                {(selectedPlatform === 'bonk' || selectedPlatform === 'usd1') && (
                  <button
                    onClick={() => setBonkersEnabled(prev => !prev)}
                    className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors ${
                      bonkersEnabled
                        ? 'border-white/[0.15] bg-white/[0.06] text-white'
                        : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${bonkersEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                      {bonkersEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate">Bonkers</span>
                  </button>
                )}

                {/* Auto-Sell */}
                <button
                  onClick={() => setAutoSellEnabled(prev => !prev)}
                  className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors ${
                    autoSellEnabled
                      ? 'border-white/[0.15] bg-white/[0.06] text-white'
                      : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${autoSellEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                    {autoSellEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <span className="truncate">Auto-Sell</span>
                </button>

                {/* Bundle */}
                <div ref={bundleButtonRef}>
                  <button
                    onClick={() => { setBundleEnabled(prev => !prev); }}
                    className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors w-full ${
                      bundleEnabled
                        ? 'border-white/[0.15] bg-white/[0.06] text-white'
                        : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${bundleEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                      {bundleEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate">Bundle</span>
                  </button>
                </div>

                {/* Multi Deploy */}
                <div ref={multiButtonRef}>
                  <button
                    onClick={() => { setMultiDeployEnabled(prev => !prev); setShowMultiPopup(prev => !prev); }}
                    className={`flex items-center gap-2 h-9 px-3 rounded border text-[11px] font-medium transition-colors w-full ${
                      multiDeployEnabled
                        ? 'border-white/[0.15] bg-white/[0.06] text-white'
                        : 'border-white/[0.10] bg-transparent text-white/50 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${multiDeployEnabled ? 'border-white/50 bg-white/15' : 'border-white/20'}`}>
                      {multiDeployEnabled && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className="truncate">Multi Deploy</span>
                  </button>
                </div>
              </div>
            ) : (
            <div className="flex flex-wrap gap-1 px-0.5">
              {/* Bonkers — Bonk and USD1 only, at the start */}
              {(selectedPlatform === 'bonk' || selectedPlatform === 'usd1') && (
                <button
                  onClick={() => setBonkersEnabled(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border ${
                    bonkersEnabled
                      ? 'bg-orange-500/15 text-orange-400 border-orange-500/30'
                      : 'bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}
                >
                  <span>Bonkers</span>
                  <span className={`text-[8px] font-bold ${bonkersEnabled ? 'text-orange-400' : 'text-white/25'}`}>{bonkersEnabled ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {/* Cashback — Pump only */}
              {selectedPlatform === 'pump' && (
                <button
                  onClick={() => setCashbackEnabled(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border ${
                    cashbackEnabled
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/60'
                  }`}
                >
                  <span>Cashback</span>
                  <span className={`text-[8px] font-bold ${cashbackEnabled ? 'text-emerald-400' : 'text-white/25'}`}>{cashbackEnabled ? 'ON' : 'OFF'}</span>
                </button>
              )}

              {/* Bundle — split: label opens popup, ON/OFF toggles state */}
              <div ref={bundleButtonRef} className={`flex items-center rounded text-[10px] font-semibold border overflow-hidden ${
                bundleEnabled
                  ? 'border-sky-500/30'
                  : 'border-white/[0.06]'
              }`}>
                <button
                  onClick={() => setShowBundlePopup(prev => !prev)}
                  className={`px-2.5 py-1 transition-colors ${
                    bundleEnabled
                      ? 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25'
                      : 'bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                  }`}
                >
                  Bundle
                </button>
                <div className={`w-px h-4 ${bundleEnabled ? 'bg-sky-500/30' : 'bg-white/[0.08]'}`} />
                <button
                  onClick={() => {
                    setBundleEnabled(prev => {
                      if (prev) setShowBundlePopup(false);
                      return !prev;
                    });
                  }}
                  className={`px-2 py-1 text-[8px] font-bold transition-colors ${
                    bundleEnabled
                      ? 'bg-sky-500/15 text-sky-400 hover:bg-sky-500/25'
                      : 'bg-white/[0.04] text-white/25 hover:text-white/40 hover:bg-white/[0.06]'
                  }`}
                >
                  {bundleEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Turbo Mode (nonce) — always visible */}
              <button
                onClick={() => setTurboModeEnabled(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border ${
                  turboModeEnabled
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/60'
                }`}
              >
                <span>Turbo</span>
                <span className={`text-[8px] font-bold ${turboModeEnabled ? 'text-amber-400' : 'text-white/25'}`}>{turboModeEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {/* Auto-Sell — always visible */}
              <button
                onClick={() => setAutoSellEnabled(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-colors border ${
                  autoSellEnabled
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/60'
                }`}
              >
                <span>Auto-Sell</span>
                <span className={`text-[8px] font-bold ${autoSellEnabled ? 'text-red-400' : 'text-white/25'}`}>{autoSellEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {/* Multi Deploy — split: label opens popup, ON/OFF toggles state */}
              <div ref={multiButtonRef} className={`flex items-center rounded text-[10px] font-semibold border overflow-hidden ${
                multiDeployEnabled
                  ? 'border-violet-500/30'
                  : 'border-white/[0.06]'
              }`}>
                <button
                  onClick={() => setShowMultiPopup(prev => !prev)}
                  className={`px-2.5 py-1 transition-colors ${
                    multiDeployEnabled
                      ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                      : 'bg-white/[0.04] text-white/40 hover:text-white/60 hover:bg-white/[0.06]'
                  }`}
                >
                  Multi
                </button>
                <div className={`w-px h-4 ${multiDeployEnabled ? 'bg-violet-500/30' : 'bg-white/[0.08]'}`} />
                <button
                  onClick={() => {
                    setMultiDeployEnabled(prev => {
                      if (prev) setShowMultiPopup(false);
                      return !prev;
                    });
                  }}
                  className={`px-2 py-1 text-[8px] font-bold transition-colors ${
                    multiDeployEnabled
                      ? 'bg-violet-500/15 text-violet-400 hover:bg-violet-500/25'
                      : 'bg-white/[0.04] text-white/25 hover:text-white/40 hover:bg-white/[0.06]'
                  }`}
                >
                  {multiDeployEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            )}

            {/* Auto-Sell options row — shown when auto-sell enabled */}
            {autoSellEnabled && (
              <div className="flex items-center gap-2 px-1 mt-1">
                <button
                  onClick={() => setAutoSellAll(prev => !prev)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold transition-colors border ${
                    autoSellAll
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-white/[0.04] text-white/35 border-white/[0.06] hover:text-white/50'
                  }`}
                >
                  <span>Sell All</span>
                  <span className={`text-[8px] font-bold ${autoSellAll ? 'text-red-400' : 'text-white/20'}`}>{autoSellAll ? 'ON' : 'OFF'}</span>
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[9px] text-white/40">Delay</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={autoSellDelay}
                    onChange={(e) => setAutoSellDelay(parseInt(e.target.value) || 0)}
                    className="w-12 px-1.5 py-0.5 bg-black/30 border border-white/[0.08] rounded text-white/70 text-[10px] font-semibold text-right focus:outline-none focus:border-white/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                  <span className="text-[9px] text-white/30">ms</span>
                </div>
              </div>
            )}

            {/* Bundle Wallets Popup */}
            {showBundlePopup && !showMultiPopup && (
              <div
                ref={bundlePopupRef}
                className="absolute bottom-full left-0 right-0 mb-1 z-50"
              >
                <div className="bg-black/95 backdrop-blur-md border border-sky-500/20 rounded-lg p-3 shadow-xl shadow-black/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider">Bundle Wallets</span>
                    <button
                      onClick={() => setShowBundlePopup(false)}
                      className="text-white/30 hover:text-white/60 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="text-[9px] text-white/40 mb-2">Select wallets to snipe with (max {autoSellEnabled ? '4' : '5'})</div>
                  <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
                    {wallets.map((wallet) => {
                      const shortKey = wallet.publicKey.substring(0, 4) + '...' + wallet.publicKey.substring(wallet.publicKey.length - 4);
                      const isDeployWallet = activeWallet?.publicKey === wallet.publicKey;
                      const isUsd1Direct = selectedPlatform === 'usd1' && usd1Currency === 'USD1';
                      const snipeCurrencyLabel = isUsd1Direct ? 'USD1' : 'SOL';
                      const defaultSnipeAmount = isUsd1Direct ? 100 : 0.1;
                      const config = bundleSnipeWallets[wallet.publicKey] || { enabled: false, amount: defaultSnipeAmount };
                      return (
                        <div
                          key={wallet.publicKey}
                          className={`flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] rounded-md border border-white/[0.04] ${isDeployWallet ? 'pointer-events-none' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            disabled={isDeployWallet}
                            onChange={(e) => {
                              setBundleSnipeWallets(prev => ({
                                ...prev,
                                [wallet.publicKey]: { ...config, enabled: e.target.checked }
                              }));
                            }}
                            className={`w-3 h-3 ${isDeployWallet ? 'accent-gray-600' : 'accent-sky-400'}`}
                          />
                          <span className={`font-mono text-[10px] flex-1 ${isDeployWallet ? 'text-white/25' : 'text-white/60'}`}>
                            {shortKey}{isDeployWallet ? ' (deployer)' : ''}
                          </span>
                          <input
                            type="number"
                            step="any"
                            placeholder={String(defaultSnipeAmount)}
                            value={config.amount || ''}
                            disabled={isDeployWallet}
                            onChange={(e) => {
                              setBundleSnipeWallets(prev => ({
                                ...prev,
                                [wallet.publicKey]: { ...config, amount: parseFloat(e.target.value) || 0 }
                              }));
                            }}
                            className={`w-14 px-1.5 py-0.5 bg-black/40 border rounded text-[10px] font-semibold text-right focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] ${isDeployWallet ? 'border-white/[0.04] text-white/20' : 'border-white/[0.08] text-sky-400 focus:border-sky-400/50'}`}
                          />
                          <span className={`text-[8px] font-semibold ${isDeployWallet ? 'text-white/15' : 'text-white/30'}`}>{snipeCurrencyLabel}</span>
                        </div>
                      );
                    })}
                    {wallets.length === 0 && (
                      <div className="text-[10px] text-white/30 text-center py-2">No wallets imported</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Multi Deploy Popup */}
            {showMultiPopup && (
              <div
                ref={multiPopupRef}
                className="absolute bottom-full left-0 right-0 mb-1 z-50"
              >
                <div className="bg-black/95 backdrop-blur-md border border-violet-500/20 rounded-lg p-3 shadow-xl shadow-black/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Multi Deploy</span>
                    <button
                      onClick={() => setShowMultiPopup(false)}
                      className="text-white/30 hover:text-white/60 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="text-[9px] text-white/40 mb-3">Deploy multiple tokens at once. First uses main amount, rest use secondary.</div>

                  {/* Deploy Count Slider */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[9px] text-white/50 w-10">Count</span>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      value={multiDeployCount}
                      onChange={(e) => setMultiDeployCount(parseInt(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, rgb(139 92 246 / 0.6) ${((multiDeployCount - 2) / 8) * 100}%, rgb(255 255 255 / 0.08) ${((multiDeployCount - 2) / 8) * 100}%)` }}
                    />
                    <span className="text-[11px] font-bold text-violet-400 w-6 text-right">{multiDeployCount}x</span>
                  </div>

                  {/* Secondary Amount */}
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] text-white/50 w-10">Each</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={multiDeploySecondaryAmount || ''}
                      onChange={(e) => setMultiDeploySecondaryAmount(parseFloat(e.target.value) || 0)}
                      placeholder={selectedPlatform === 'usd1' && usd1Currency === 'USD1' ? '100' : '0.1'}
                      className="flex-1 px-2 py-1 bg-black/40 border border-white/[0.08] rounded text-[10px] font-semibold text-violet-400 text-right focus:outline-none focus:border-violet-400/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <span className="text-[8px] font-semibold text-white/30 w-8">
                      {selectedPlatform === 'usd1' && usd1Currency === 'USD1' ? 'USD1' : 'SOL'}
                    </span>
                  </div>

                  <div className="text-[8px] text-white/25 mt-2">
                    Deploy #1 uses your main buy amount. Deploys #2-{multiDeployCount} use {multiDeploySecondaryAmount || (selectedPlatform === 'usd1' && usd1Currency === 'USD1' ? 100 : 0.1)} {selectedPlatform === 'usd1' && usd1Currency === 'USD1' ? 'USD1' : 'SOL'} each.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preset Amount Buttons */}
          {variant === 'launchblitz' ? (
            <>
              {/* LB-style buy amount buttons: 1 ≡, 3 ≡, 5 ≡, # */}
              <div className="flex items-center gap-2">
                {[1, 3, 5].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => handleDeployWithAmount(amt)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-white/[0.10] bg-white/[0.03] text-white/80 hover:bg-white/[0.06] hover:text-white text-[14px] font-semibold transition-colors"
                  >
                    <span>{amt}</span>
                    <svg className="w-3.5 h-3.5 text-white/30" fill="currentColor" viewBox="0 0 16 16">
                      <rect x="2" y="2" width="12" height="2" rx="0.5" />
                      <rect x="2" y="7" width="12" height="2" rx="0.5" />
                      <rect x="2" y="12" width="12" height="2" rx="0.5" />
                    </svg>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setTempPresets(activePresets.map(String));
                    setIsEditingPresets(true);
                  }}
                  className="flex items-center justify-center px-4 py-2.5 rounded border border-white/[0.10] bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/70 text-[14px] font-semibold transition-colors"
                  title="Custom buy amount"
                >
                  <span>#</span>
                </button>
                <button
                  onClick={() => {}}
                  className="flex items-center justify-center w-10 py-2.5 rounded border border-white/[0.10] bg-white/[0.03] text-white/30 hover:bg-white/[0.06] hover:text-white/50 transition-colors"
                  title="More options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Presets placeholder */}
              <div className="text-[13px] text-white/40 py-1">
                {savedTokens.length > 0 ? null : (
                  <span>No presets yet. <button onClick={() => handleSaveToken()} className="text-white/60 underline underline-offset-2 hover:text-white transition-colors">Create one</button> to launch faster.</span>
                )}
              </div>
            </>
          ) : (
          <div className="flex gap-1">
            {isEditingPresets ? (
              <>
                {tempPresets.map((val, i) => (
                  <div key={i} className="flex-1 relative w-0 min-w-0">
                    <Image src={activeCurrencyIcon} alt="" width={10} height={10} className="opacity-30 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const newPresets = [...tempPresets];
                        newPresets[i] = e.target.value;
                        setTempPresets(newPresets);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const parsed = tempPresets.map(v => parseFloat(v) || 0).filter(v => v > 0);
                          if (parsed.length === 5) { setActivePresets(parsed); storeSet(activePresetsKey, JSON.stringify(parsed)); }
                          setIsEditingPresets(false);
                        }
                      }}
                      className="w-full pl-5 pr-1 py-1.5 rounded border border-white/[0.1] bg-white/[0.06] text-white text-[11px] font-medium text-center focus:outline-none focus:border-blue-500/40"
                    />
                  </div>
                ))}
                <button
                  onClick={() => {
                    const parsed = tempPresets.map(v => parseFloat(v) || 0).filter(v => v > 0);
                    if (parsed.length === 5) {
                      setActivePresets(parsed);
                      storeSet(activePresetsKey, JSON.stringify(parsed));
                    }
                    setIsEditingPresets(false);
                  }}
                  className="px-1.5 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] text-white/30 text-xs hover:bg-white/[0.1] hover:text-white transition-colors"
                  title="Save preset amounts"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </button>
              </>
            ) : (
              <>
                {activePresets.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleDeployWithAmount(amount)}
                    className="flex-1 px-1 py-1.5 rounded border text-[11px] font-medium btn-lift bg-white/[0.04] border-white/[0.06] text-white/50 hover:border-white/[0.12] hover:bg-white/[0.1] hover:text-white/90 flex items-center justify-center gap-1"
                  >
                    <Image src={activeCurrencyIcon} alt="" width={12} height={12} className="opacity-50" />
                    <span>{amount}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setTempPresets(activePresets.map(String));
                    setIsEditingPresets(true);
                  }}
                  className="px-1.5 py-1.5 rounded-md border border-white/[0.06] bg-white/[0.04] text-white/30 text-xs hover:bg-white/[0.1] hover:text-white transition-colors"
                  title="Edit preset amounts"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                </button>
              </>
            )}
          </div>
          )}

          {/* Bundle Quick-Buy Preset Buttons — hidden when bundle toggle is ON */}
          {variant !== 'launchblitz' && !bundleEnabled && (() => {
            const hasBlock0Wallets = Object.values(block0SnipeWallets).some(c => c.enabled);
            return (
            <div className="flex gap-1">
              {isEditingBundlePresets ? (
                <>
                  {tempBundlePresets.map((val, i) => (
                    <div key={i} className="flex-1 relative w-0 min-w-0">
                      <svg className="w-2.5 h-2.5 opacity-30 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-sky-400" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="1" width="12" height="3" rx="0.5" opacity="0.5" />
                        <rect x="2" y="6" width="12" height="3" rx="0.5" opacity="0.7" />
                        <rect x="2" y="11" width="12" height="3" rx="0.5" />
                      </svg>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const newPresets = [...tempBundlePresets];
                          newPresets[i] = e.target.value;
                          setTempBundlePresets(newPresets);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const parsed = tempBundlePresets.map(v => parseFloat(v) || 0).filter(v => v > 0);
                            if (parsed.length === 5) { setActiveBundlePresets(parsed); storeSet(activeBundlePresetsKey, JSON.stringify(parsed)); }
                            setIsEditingBundlePresets(false);
                          }
                        }}
                        className="w-full pl-5 pr-1 py-1.5 rounded border border-sky-500/[0.15] bg-sky-500/[0.06] text-white text-[11px] font-medium text-center focus:outline-none focus:border-sky-400/40"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const parsed = tempBundlePresets.map(v => parseFloat(v) || 0).filter(v => v > 0);
                      if (parsed.length === 5) {
                        setActiveBundlePresets(parsed);
                        storeSet(activeBundlePresetsKey, JSON.stringify(parsed));
                      }
                      setIsEditingBundlePresets(false);
                    }}
                    className="px-1.5 py-1.5 rounded-md border border-sky-500/[0.12] bg-sky-500/[0.06] text-sky-400/30 text-xs hover:bg-sky-500/[0.12] hover:text-sky-300 transition-colors"
                    title="Save bundle preset amounts"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </button>
                </>
              ) : (
                <>
                  {activeBundlePresets.map((amount) => (
                    <button
                      key={`bundle-${amount}`}
                      onClick={() => hasBlock0Wallets ? handleBundleDeployWithAmount(amount) : undefined}
                      disabled={!hasBlock0Wallets}
                      className={`flex-1 px-1 py-1.5 rounded border text-[11px] font-medium flex items-center justify-center gap-1 ${
                        hasBlock0Wallets
                          ? 'btn-lift bg-sky-500/[0.06] border-sky-500/[0.12] text-sky-400/60 hover:border-sky-400/30 hover:bg-sky-500/[0.12] hover:text-sky-300'
                          : 'bg-white/[0.02] border-white/[0.04] text-white/15 cursor-not-allowed'
                      }`}
                      title={hasBlock0Wallets ? undefined : 'Set bundle wallets in Deploy Settings first'}
                    >
                      <svg className={`w-2.5 h-2.5 flex-shrink-0 ${hasBlock0Wallets ? 'opacity-50' : 'opacity-20'}`} viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="1" width="12" height="3" rx="0.5" opacity="0.5" />
                        <rect x="2" y="6" width="12" height="3" rx="0.5" opacity="0.7" />
                        <rect x="2" y="11" width="12" height="3" rx="0.5" />
                      </svg>
                      <span>{amount}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setTempBundlePresets(activeBundlePresets.map(String));
                      setIsEditingBundlePresets(true);
                    }}
                    className="px-1.5 py-1.5 rounded-md border border-sky-500/[0.12] bg-sky-500/[0.06] text-sky-400/30 text-xs hover:bg-sky-500/[0.12] hover:text-sky-300 transition-colors"
                    title="Edit bundle preset amounts"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                  </button>
                </>
              )}
            </div>
            );
          })()}

          {/* Deploy Row — full width button with amount inline */}
          {variant !== 'launchblitz' && <div className="flex gap-1.5 relative">
            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className={`flex-1 px-3 py-2 btn-deploy btn-lift ${isDeploying ? 'bg-white/[0.06] cursor-not-allowed border border-white/[0.06]' : testMode ? 'bg-white/[0.03] hover:bg-blue-500/10 border border-white/[0.06] hover:border-blue-500/30 text-white/40 hover:text-blue-400' : 'bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 shadow-[0_2px_8px_rgba(59,130,246,0.15)]'} text-xs font-bold rounded flex items-center justify-center gap-2`}
            >
              {isDeploying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{testMode ? 'Generating...' : 'Deploying...'}</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <span>{testMode ? 'DEPLOY' : `Deploy (${deployKeybind})`}</span>
                </>
              )}
            </button>
            <div className="relative flex-shrink-0">
              <input
                type="text"
                inputMode="decimal"
                value={amountInputStr}
                onChange={(e) => {
                  const v = e.target.value;
                  // Allow digits, one decimal point, and empty
                  if (v === '' || /^\d*\.?\d*$/.test(v)) {
                    setAmountInputStr(v);
                    const num = parseFloat(v);
                    if (!isNaN(num)) setActiveAmount(num);
                  }
                }}
                onBlur={() => {
                  // Normalize display on blur
                  const num = parseFloat(amountInputStr);
                  if (isNaN(num) || num === 0) {
                    setAmountInputStr('');
                  } else {
                    setAmountInputStr(String(num));
                    setActiveAmount(num);
                  }
                }}
                onKeyDown={handleKeyDown}
                className={`w-20 ${theme.inputBg} text-white pl-2 pr-1 py-2 rounded border ${theme.inputBorder} text-xs focus:outline-none focus:border-white/20 font-semibold text-center input-premium`}
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-white/40 font-semibold pointer-events-none">{activeCurrencyLabel}</span>
            </div>
          </div>}

          {/* LETTER / SOL / ASCII / Google quick-deploy row */}
          {variant !== 'launchblitz' && <div className="flex gap-1 relative">
            <button
              onClick={() => {
                setSelectedImageMode("letter");
                setUploadedImage(null);
                pendingQuickDeployRef.current = { amount: activeAmount, imageMode: "letter" };
              }}
              disabled={isDeploying}
              className={`flex-1 px-2 py-1.5 btn-lift ${isDeploying ? 'bg-white/[0.08]' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.1] hover:border-white/[0.15]'} text-white/50 hover:text-white text-[10px] font-semibold rounded border`}
            >
              LETTER
            </button>
            <button
              onClick={() => {
                setSelectedImageMode("sol");
                setUploadedImage(null);
                pendingQuickDeployRef.current = { amount: activeAmount, imageMode: "sol" };
              }}
              disabled={isDeploying}
              className={`flex-1 px-2 py-1.5 btn-lift ${isDeploying ? 'bg-white/[0.08]' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.1] hover:border-white/[0.15]'} text-[10px] font-bold rounded border`}
            >
              <span style={{ background: 'linear-gradient(90deg, #9945FF, #14F195)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SOL</span>
            </button>
            <button
              onClick={() => {
                setSelectedImageMode("ascii");
                setUploadedImage(null);
                pendingQuickDeployRef.current = { amount: activeAmount, imageMode: "ascii" };
              }}
              disabled={isDeploying}
              className={`flex-1 px-2 py-1.5 btn-lift ${isDeploying ? 'bg-white/[0.08]' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.1] hover:border-white/[0.15]'} text-white/50 hover:text-white text-[10px] rounded border`}
            >
              <span className="font-mono tracking-tight">&gt;_ASCII</span>
            </button>
            <button
              onClick={() => setShowGoogleSearch(prev => !prev)}
              className={`flex-1 px-2 py-1.5 btn-lift ${showGoogleSearch ? 'bg-purple-600/30 border-purple-500/40' : 'bg-white/[0.04] border-white/[0.06] hover:bg-white/[0.1] hover:border-white/[0.15]'} text-white/50 hover:text-white text-[10px] font-semibold rounded-md border flex items-center justify-center gap-1`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/></svg>
              Google
            </button>
          </div>}

          {/* Google Image Search Popdown */}
          {showGoogleSearch && (
            <div ref={googleSearchRef} className="mt-2 rounded-lg border border-white/[0.08] bg-black/40 backdrop-blur-sm overflow-hidden">
              <form
                onSubmit={(e) => { e.preventDefault(); handleGoogleSearch(googleQuery); }}
                className="flex gap-1.5 p-2 border-b border-white/[0.06]"
              >
                <input
                  ref={googleInputRef}
                  type="text"
                  placeholder="Search Google Images..."
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  className={`flex-1 ${theme.inputBg} text-white text-xs px-2.5 py-1.5 rounded border ${theme.inputBorder} focus:outline-none focus:border-purple-500 placeholder-white/20 min-w-0 input-premium`}
                />
                <button
                  type="submit"
                  disabled={isGoogleSearching || !googleQuery.trim()}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-white/[0.06] disabled:text-white/30 text-white text-xs rounded transition-colors font-medium"
                >
                  {isGoogleSearching ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/></svg>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGoogleSearch(false)}
                  className="px-1.5 py-1.5 text-white/40 hover:text-white transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </form>
              <div className="max-h-[250px] overflow-y-auto p-2">
                {isGoogleSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : googleResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {googleResults.map((result, i) => (
                      <button
                        key={i}
                        onClick={() => selectGoogleImage(result.imageUrl, i)}
                        className={`aspect-square bg-white/[0.04] rounded overflow-hidden border transition-all ${
                          googleLoadingIndex === i ? 'border-purple-500 ring-1 ring-purple-500/40' : 'border-white/[0.06] hover:border-purple-500/60'
                        }`}
                        title={result.title}
                      >
                        <div className="w-full h-full relative">
                          <img
                            src={result.thumbnailUrl || result.imageUrl}
                            alt={result.title || ''}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          {googleLoadingIndex === i && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : googleQuery && !isGoogleSearching ? (
                  <div className="text-center py-6 text-white/40">
                    <p className="text-xs">No results found</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-white/25">
                    <svg className="w-6 h-6 mx-auto mb-1 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" strokeWidth="2"/><path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round"/></svg>
                    <p className="text-[10px]">Search for images</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Crop Modal */}
      {showCropModal && uploadedImage && (
        <CropModal
          imageSrc={uploadedImage}
          onClose={() => setShowCropModal(false)}
          onCrop={(croppedDataUrl) => {
            const original = uploadedImage!;
            setImageOptions(prev => {
              const hasOriginal = prev.includes(original);
              if (hasOriginal) {
                // Original already in options — insert cropped right after it
                const idx = prev.indexOf(original);
                const next = prev.filter(u => u !== croppedDataUrl);
                next.splice(idx + 1, 0, croppedDataUrl);
                return next;
              }
              // Original wasn't in options — add both (original + cropped)
              return [...prev, original, croppedDataUrl];
            });
            setUploadedImage(croppedDataUrl);
            setShowCropModal(false);
          }}
        />
      )}

      {/* Test Mode Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPreview(false)}>
          <div className="w-full max-w-sm mx-4 rounded-xl border border-white/[0.08] overflow-hidden max-h-[90vh] overflow-y-auto" style={{ background: 'linear-gradient(180deg, rgba(15,15,20,0.98) 0%, rgba(10,10,14,0.99) 100%)' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-white/90 text-sm font-semibold tracking-tight">Test Preview</span>
                <span className="text-white/20 text-[9px]">No real deployment</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/40"><line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" /></svg>
              </button>
            </div>

            {/* Token info row — image + name inline */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-3 p-2 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/40 border border-white/[0.06] flex-shrink-0">
                  <img src={previewData.image} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-bold text-sm leading-tight truncate">{previewData.name}</div>
                  <div className="text-emerald-400 font-bold text-[11px]">${previewData.symbol}</div>
                  <div className="text-white/20 text-[9px] truncate mt-0.5">{previewData.imageSource}</div>
                </div>
              </div>
            </div>

            {/* Deploy settings */}
            <div className="px-4 pb-2">
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {([
                  { label: 'Platform', value: previewData.platform, color: 'text-blue-400' },
                  { label: 'Dev Buy', value: `${previewData.amount} ${previewData.currency}`, color: 'text-purple-400' },
                  { label: 'Deployer', value: previewData.deployerWallet, color: 'text-white/60' },
                  ...(previewData.twitter ? [{ label: 'Twitter', value: previewData.twitter, color: 'text-sky-400' }] : []),
                  ...(previewData.website ? [{ label: 'Website', value: previewData.website, color: 'text-sky-400' }] : []),
                ] as { label: string; value: string; color: string }[]).map((row, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-white/30 text-[10px] font-medium">{row.label}</span>
                    <span className={`${row.color} text-[10px] font-semibold truncate max-w-[200px] text-right`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Toggles row */}
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-1">
                {([
                  { label: 'Bundle', on: previewData.bundleEnabled, onClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
                  { label: 'Turbo', on: previewData.turboMode, onClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                  { label: 'Auto-Sell', on: previewData.autoSell, onClass: 'bg-red-500/15 text-red-400 border-red-500/30' },
                  ...(previewData.autoSell ? [{ label: 'Sell All', on: previewData.autoSellAll, onClass: 'bg-red-500/15 text-red-400 border-red-500/30' }] : []),
                  { label: 'Bonkers', on: previewData.bonkers, onClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
                  { label: 'Cashback', on: previewData.cashback, onClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
                  { label: 'Multi', on: previewData.multiDeploy, onClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
                ] as { label: string; on: boolean; onClass: string }[]).map((t) => (
                  <span key={t.label} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                    t.on ? t.onClass : 'bg-white/[0.02] text-white/20 border-white/[0.04]'
                  }`}>
                    {t.label} {t.on ? 'ON' : 'OFF'}
                  </span>
                ))}
                {previewData.autoSell && previewData.autoSellDelay > 0 && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-white/[0.02] text-white/30 border-white/[0.04]">
                    Delay {previewData.autoSellDelay}ms
                  </span>
                )}
                {previewData.multiDeploy && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded border bg-white/[0.02] text-white/30 border-white/[0.04]">
                    x{previewData.multiDeployCount}
                  </span>
                )}
              </div>
            </div>

            {/* Bundle wallets */}
            {previewData.bundleEnabled && previewData.snipeWallets.length > 0 && (
              <div className="px-4 pb-2">
                <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-1">Block 0 Wallets ({previewData.snipeWallets.length})</div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                  {previewData.snipeWallets.map((w, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-white/40 text-[10px] font-mono">{w.publicKey.substring(0, 4)}...{w.publicKey.substring(w.publicKey.length - 4)}</span>
                      <span className="text-sky-400 text-[10px] font-semibold">{w.amount} {previewData.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previewData.bundleEnabled && previewData.snipeWallets.length === 0 && (
              <div className="px-4 pb-2">
                <div className="text-[9px] text-white/25 italic">Bundle enabled but no snipe wallets configured</div>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={() => setShowPreview(false)}
                className="w-full py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 hover:text-white/80 text-xs font-medium transition-colors border border-white/[0.06]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Crop Modal ---
interface CropModalProps {
  imageSrc: string;
  onClose: () => void;
  onCrop: (croppedDataUrl: string) => void;
}

function CropModal({ imageSrc, onClose, onCrop }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const imgElRef = useRef<HTMLImageElement | null>(null);

  const CROP_SIZE = 300;
  const OUTPUT_SIZE = 512;

  // Load image and compute initial fit scale
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgElRef.current = img;
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      // Scale so shortest side fills the crop area
      const fitScale = CROP_SIZE / Math.min(img.naturalWidth, img.naturalHeight);
      setScale(fitScale);
      setOffset({ x: 0, y: 0 });
      setImageLoaded(true);
    };
    // Handle proxy URLs
    const src = imageSrc.startsWith('http') && !imageSrc.startsWith('data:')
      ? `/api/proxy-image?url=${encodeURIComponent(imageSrc)}`
      : imageSrc;
    img.src = src;
  }, [imageSrc]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Multiplicative zoom: 15% per scroll step
    const factor = e.deltaY > 0 ? 0.85 : 1.15;
    setScale(prev => Math.max(0.02, Math.min(10, prev * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    offsetAtDragStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: offsetAtDragStart.current.x + (e.clientX - dragStartRef.current.x),
      y: offsetAtDragStart.current.y + (e.clientY - dragStartRef.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleCrop = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgElRef.current;
    if (!canvas || !img) return;

    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map from display coordinates to output coordinates
    const outputScale = OUTPUT_SIZE / CROP_SIZE;
    const drawW = naturalSize.w * scale * outputScale;
    const drawH = naturalSize.h * scale * outputScale;
    const drawX = (OUTPUT_SIZE / 2) - (drawW / 2) + (offset.x * outputScale);
    const drawY = (OUTPUT_SIZE / 2) - (drawH / 2) + (offset.y * outputScale);

    ctx.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    onCrop(canvas.toDataURL('image/png'));
  }, [scale, offset, naturalSize, onCrop]);

  // Zoom percentage relative to "fit" size
  const fitScale = naturalSize.w > 0 ? CROP_SIZE / Math.min(naturalSize.w, naturalSize.h) : 1;
  const zoomPercent = Math.round((scale / fitScale) * 100);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0f1118] rounded-xl w-[400px] border border-white/[0.06] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
          <span className="text-[13px] font-medium text-white/90 tracking-tight">Crop Image</span>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
            <XIcon size={14} />
          </button>
        </div>

        {/* Crop area */}
        <div className="px-5 py-4 flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden bg-black/40 rounded-lg cursor-grab active:cursor-grabbing ring-1 ring-white/[0.08]"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageLoaded && (
              <img
                src={imgElRef.current?.src || imageSrc}
                alt="Crop preview"
                draggable={false}
                className="absolute select-none pointer-events-none"
                style={{
                  width: naturalSize.w * scale,
                  height: naturalSize.h * scale,
                  maxWidth: 'none',
                  maxHeight: 'none',
                  left: (CROP_SIZE / 2) - (naturalSize.w * scale / 2) + offset.x,
                  top: (CROP_SIZE / 2) - (naturalSize.h * scale / 2) + offset.y,
                }}
              />
            )}
            {/* Crop grid overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/[0.08]" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/[0.08]" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/[0.08]" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/[0.08]" />
            </div>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-white/25 text-xs">Loading...</div>
            )}
          </div>

          {/* Zoom slider */}
          <div className="w-full flex items-center gap-2.5">
            <span className="text-[10px] text-white/30 w-8 text-right flex-shrink-0 tabular-nums">{zoomPercent}%</span>
            <input
              type="range"
              min={0.02}
              max={10}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 h-[3px] bg-white/[0.08] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white/80 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-sm"
            />
            <button
              onClick={() => { setScale(fitScale); setOffset({ x: 0, y: 0 }); }}
              className="text-[10px] text-white/30 hover:text-white/70 transition-colors flex-shrink-0"
            >
              Reset
            </button>
          </div>

          <div className="text-[10px] text-white/20 text-center">Scroll to zoom &middot; Drag to pan &middot; {OUTPUT_SIZE}&times;{OUTPUT_SIZE}px</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="px-4 py-1.5 bg-white/[0.08] hover:bg-white/[0.14] text-white/90 text-[12px] font-medium rounded-md transition-colors ring-1 ring-white/[0.06]"
          >
            Crop &amp; Save
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
