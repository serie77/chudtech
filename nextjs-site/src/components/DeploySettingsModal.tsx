"use client";

import { X, Trash2, Copy, Upload, Settings, Download, UploadCloud, GripVertical } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { saveWallet, getWalletPrivateKey, removeWallet as removeStoredWallet, getDeploymentService, getNonceAccount, getNoncePool, getRegionKey } from "@/services/tokenApi";
import { storeGet, storeSet } from "@/lib/store";
import { getTheme } from "@/utils/themes";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface Wallet {
  id: string;
  type: 'solana' | 'evm';
  publicKey: string;
  privateKey: string;
  compositeKey: string; // The backend's encrypted composite key
  balance: number;
  isActive: boolean;
}

interface CustomPreset {
  id: string;
  name: string;
  namePrefix: string;
  nameSuffix: string;
  deployPlatform: string;
  tickerMode: string;
  imageType: string;
  keybind: string;
  customImageUrl?: string;
}

interface DeploySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletChange?: (wallet: Wallet | null) => void;
  wallets?: Wallet[];
  onWalletsChange?: (wallets: Wallet[]) => void;
  presets: CustomPreset[];
  onPresetsChange: (presets: CustomPreset[]) => void;
  themeId?: string;
}

export default function DeploySettingsModal({ isOpen, onClose, onWalletChange, wallets: externalWallets, onWalletsChange, presets, onPresetsChange, themeId = 'modern-dark' }: DeploySettingsModalProps) {
  const theme = getTheme(themeId);
  const [internalWallets, setInternalWallets] = useState<Wallet[]>([]);
  const wallets = externalWallets ?? internalWallets;
  const setWallets = (newWallets: Wallet[]) => {
    if (onWalletsChange) onWalletsChange(newWallets);
    else setInternalWallets(newWallets);
  };
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'solana' | 'evm'>('solana');
  const [privateKeyInput, setPrivateKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [nonceLoading, setNonceLoading] = useState<string | null>(null);
  const [nonceStatus, setNonceStatus] = useState<Record<string, string>>({});

  // Block 0 bundle wallet selection
  const [block0Wallets, setBlock0Wallets] = useState<Record<string, { enabled: boolean }>>(() => {
    if (typeof window !== 'undefined') { try { const v = storeGet(`nnn-block0-wallets-${getRegionKey()}`); if (v) return JSON.parse(v); } catch {} } return {};
  });
  const toggleBlock0 = (publicKey: string) => {
    setBlock0Wallets(prev => {
      const next = { ...prev, [publicKey]: { enabled: !prev[publicKey]?.enabled } };
      storeSet(`nnn-block0-wallets-${getRegionKey()}`, JSON.stringify(next));
      return next;
    });
  };

  // Custom Presets form state
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isCapturingKeybind, setIsCapturingKeybind] = useState(false);
  const [newPreset, setNewPreset] = useState<CustomPreset>({
    id: '',
    name: '',
    namePrefix: '',
    nameSuffix: '',
    deployPlatform: 'Use Account Default',
    tickerMode: 'Selected Text',
    imageType: 'Image in Post',
    keybind: ''
  });

  // Insta-Deploy settings - Load from localStorage
  const [primaryKeybind, setPrimaryKeybind] = useState(() => {
    if (typeof window !== 'undefined') {
      return storeGet('insta-deploy-primary') || "Ctrl + X";
    }
    return "Ctrl + X";
  });
  const [secondaryKeybind, setSecondaryKeybind] = useState(() => {
    if (typeof window !== 'undefined') {
      return storeGet('insta-deploy-secondary') || "";
    }
    return "";
  });
  const [doubleClickEnabled, setDoubleClickEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return storeGet('insta-deploy-double-click') === 'true';
    }
    return false;
  });
  const [aiFillModifier, setAiFillModifier] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('ai-fill-modifier') || 'Alt';
    return 'Alt';
  });
  const [isCapturingPrimary, setIsCapturingPrimary] = useState(false);
  const [isCapturingSecondary, setIsCapturingSecondary] = useState(false);

  // Quick Buy settings — load from same localStorage keys as Panel1
  const [solPresets, setSolPresets] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = storeGet('deployPresetAmounts'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === 5) return p.map(String); } } catch {}
    }
    return ['1', '2', '3', '4', '5'];
  });
  const [usd1Presets, setUsd1Presets] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = storeGet('deployPresetAmountsUSD1'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === 5) return p.map(String); } } catch {}
    }
    return ['50', '100', '250', '500', '1000'];
  });
  const [bundleSolPresets, setBundleSolPresets] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = storeGet('deployBundlePresetAmounts'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === 5) return p.map(String); } } catch {}
    }
    return ['0.5', '1', '2', '3', '5'];
  });
  const [bundleUsd1Presets, setBundleUsd1Presets] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = storeGet('deployBundlePresetAmountsUSD1'); if (s) { const p = JSON.parse(s); if (Array.isArray(p) && p.length === 5) return p.map(String); } } catch {}
    }
    return ['50', '100', '250', '500', '1000'];
  });
  const [defaultSolAmount, setDefaultSolAmount] = useState<string>(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-buy-amount') || '0.01';
    return '0.01';
  });
  const [defaultUsd1Amount, setDefaultUsd1Amount] = useState<string>(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-usd1-buy-amount') || '100';
    return '100';
  });

  // Auto-Deploy settings
  const [autoDeployOnPaste, setAutoDeployOnPaste] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-auto-deploy-paste') === 'true';
    return false;
  });
  const [defaultAiPlatform, setDefaultAiPlatform] = useState(() => {
    if (typeof window !== 'undefined') return storeGet('nnn-ai-default-platform') || 'pump';
    return 'pump';
  });

  // Deploy Button position/scale settings
  const [deployBtnPosition, setDeployBtnPosition] = useState<'left' | 'right' | 'top-right'>(() => {
    if (typeof window !== 'undefined') {
      const v = storeGet('nnn-deploy-btn-position');
      if (v === 'left' || v === 'right' || v === 'top-right') return v;
    }
    return 'top-right';
  });
  const [deployBtnScale, setDeployBtnScale] = useState(() => {
    if (typeof window !== 'undefined') {
      const v = parseInt(storeGet('nnn-deploy-btn-scale') || '100', 10);
      if (v >= 60 && v <= 200) return v;
    }
    return 100;
  });
  const [aiClickMode, setAiClickMode] = useState<'hold' | 'click'>(() => {
    if (typeof window !== 'undefined') {
      const v = storeGet('nnn-ai-click-mode');
      if (v === 'hold' || v === 'click') return v;
    }
    return 'hold';
  });

  // Save settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      storeSet('insta-deploy-primary', primaryKeybind);
      storeSet('insta-deploy-secondary', secondaryKeybind);
      storeSet('insta-deploy-double-click', String(doubleClickEnabled));
      storeSet('ai-fill-modifier', aiFillModifier);
      // Notify Panel1 of keybind change (same-tab localStorage writes don't fire StorageEvent)
      window.dispatchEvent(new Event('nnn-keybind-change'));
    }
  }, [primaryKeybind, secondaryKeybind, doubleClickEnabled, aiFillModifier]);

  // Persist Quick Buy settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parsed = solPresets.map(v => parseFloat(v) || 0);
      if (parsed.every(v => v > 0)) storeSet('deployPresetAmounts', JSON.stringify(parsed));
    }
  }, [solPresets]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parsed = usd1Presets.map(v => parseFloat(v) || 0);
      if (parsed.every(v => v > 0)) storeSet('deployPresetAmountsUSD1', JSON.stringify(parsed));
    }
  }, [usd1Presets]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parsed = bundleSolPresets.map(v => parseFloat(v) || 0);
      if (parsed.every(v => v > 0)) storeSet('deployBundlePresetAmounts', JSON.stringify(parsed));
    }
  }, [bundleSolPresets]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const parsed = bundleUsd1Presets.map(v => parseFloat(v) || 0);
      if (parsed.every(v => v > 0)) storeSet('deployBundlePresetAmountsUSD1', JSON.stringify(parsed));
    }
  }, [bundleUsd1Presets]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = parseFloat(defaultSolAmount);
      if (val > 0) storeSet('nnn-buy-amount', String(val));
    }
  }, [defaultSolAmount]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const val = parseFloat(defaultUsd1Amount);
      if (val > 0) storeSet('nnn-usd1-buy-amount', String(val));
    }
  }, [defaultUsd1Amount]);

  // Persist Auto-Deploy settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      storeSet('nnn-auto-deploy-paste', String(autoDeployOnPaste));
      storeSet('nnn-ai-default-platform', defaultAiPlatform);
    }
  }, [autoDeployOnPaste, defaultAiPlatform]);

  // Persist Deploy Button position/scale
  useEffect(() => {
    if (typeof window !== 'undefined') {
      storeSet('nnn-deploy-btn-position', deployBtnPosition);
      storeSet('nnn-deploy-btn-scale', String(deployBtnScale));
      window.dispatchEvent(new CustomEvent('nnn-deploy-btn-change', { detail: { position: deployBtnPosition, scale: deployBtnScale } }));
    }
  }, [deployBtnPosition, deployBtnScale]);

  // Persist AI click mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      storeSet('nnn-ai-click-mode', aiClickMode);
    }
  }, [aiClickMode]);

  const handleImportWallet = async () => {
    if (!privateKeyInput.trim()) return;

    try {
      let publicKey: string;
      let compositeKey: string;

      if (importType === 'solana') {
        // Derive Solana public key locally — private key never leaves client
        try {
          const privateKeyBytes = bs58.decode(privateKeyInput.trim());
          const keypair = Keypair.fromSecretKey(privateKeyBytes);
          publicKey = keypair.publicKey.toBase58();
          compositeKey = `${publicKey}:local`;
          // Save obfuscated (XOR + base64) to localStorage — same as 222 extension
          saveWallet(publicKey, privateKeyInput.trim(), `Wallet ${wallets.length + 1}`);
        } catch (error) {
          console.error('[222] Import error:', error);
          alert('Invalid private key. Please check and try again.');
          return;
        }
      } else {
        // For EVM, generate mock public key
        let result = '0x';
        for (let i = 0; i < 40; i++) {
          const charIndex = (privateKeyInput.charCodeAt(i % privateKeyInput.length) + i) % 16;
          result += charIndex.toString(16);
        }
        publicKey = result;
        compositeKey = `${publicKey}:mock_encrypted_key`;
      }

      // Fetch real SOL balance using Solscan API (fast and accurate)
      let balance = 0;
      if (importType === 'solana') {
        try {
          const response = await fetch(`/api/solscan?address=${publicKey}`);
          if (response.ok) {
            const data = await response.json();
            balance = data.balance || 0;
          }
        } catch (error) {
          console.error('Failed to fetch balance from Solscan:', error);
          balance = 0;
        }
      }

      const newWallet: Wallet = {
        id: Date.now().toString(),
        type: importType,
        publicKey: publicKey,
        privateKey: privateKeyInput.trim(),
        compositeKey: compositeKey,
        balance: balance,
        isActive: wallets.length === 0
      };

      const updatedWallets = [...wallets, newWallet];
      setWallets(updatedWallets);

      if (newWallet.isActive && onWalletChange) {
        onWalletChange(newWallet);
      }

      setPrivateKeyInput("");
      setShowImportModal(false);
    } catch (error) {
      console.error('Error importing wallet:', error);
      alert('Error importing wallet. Please check your private key and try again.');
    }
  };

  const handleSetActive = (walletId: string) => {
    const updatedWallets = wallets.map(w => ({
      ...w,
      isActive: w.id === walletId
    }));
    setWallets(updatedWallets);

    const activeWallet = updatedWallets.find(w => w.id === walletId);
    if (onWalletChange) {
      onWalletChange(activeWallet || null);
    }
  };

  const handleDeleteWallet = (walletId: string) => {
    const updatedWallets = wallets.filter(w => w.id !== walletId);
    setWallets(updatedWallets);

    // If deleted wallet was active, set first wallet as active
    if (updatedWallets.length > 0 && !updatedWallets.some(w => w.isActive)) {
      updatedWallets[0].isActive = true;
      if (onWalletChange) {
        onWalletChange(updatedWallets[0]);
      }
    } else if (updatedWallets.length === 0 && onWalletChange) {
      onWalletChange(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Sort: active wallet first, then preserve order
  const solanaWallets = wallets.filter(w => w.type === 'solana').sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return 0;
  });
  const evmWallets = wallets.filter(w => w.type === 'evm').sort((a, b) => {
    if (a.isActive) return -1;
    if (b.isActive) return 1;
    return 0;
  });

  // Drag-to-reorder state
  const dragItemRef = useRef<string | null>(null);
  const dragOverItemRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (walletId: string) => {
    dragItemRef.current = walletId;
  };

  const handleDragOver = (e: React.DragEvent, walletId: string) => {
    e.preventDefault();
    dragOverItemRef.current = walletId;
    setDragOverId(walletId);
  };

  const handleDragEnd = () => {
    if (!dragItemRef.current || !dragOverItemRef.current || dragItemRef.current === dragOverItemRef.current) {
      setDragOverId(null);
      return;
    }
    const newWallets = [...wallets];
    const dragIdx = newWallets.findIndex(w => w.id === dragItemRef.current);
    const overIdx = newWallets.findIndex(w => w.id === dragOverItemRef.current);
    if (dragIdx !== -1 && overIdx !== -1) {
      const [removed] = newWallets.splice(dragIdx, 1);
      newWallets.splice(overIdx, 0, removed);
      setWallets(newWallets);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
    setDragOverId(null);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className={`max-w-3xl max-h-[90vh] p-0 flex flex-col overflow-hidden ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <DialogTitle className="sr-only">Deploy Settings</DialogTitle>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white/90 tracking-wide uppercase">Deploy Settings</h2>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors p-1 rounded-md hover:bg-white/[0.06]">
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="wallets" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="px-5 gap-0.5">
              <TabsTrigger value="wallets">Wallets</TabsTrigger>
              <TabsTrigger value="quick-buy">Quick Buy</TabsTrigger>
              <TabsTrigger value="auto-deploy">Auto-Deploy</TabsTrigger>
              <TabsTrigger value="button">Button</TabsTrigger>
              <TabsTrigger value="insta-deploy">Insta-Deploy</TabsTrigger>
              <TabsTrigger value="extensions">Extensions</TabsTrigger>
              <TabsTrigger value="custom-presets">Presets</TabsTrigger>
            </TabsList>

            {/* Wallets Tab */}
            <TabsContent value="wallets" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                {/* Import Wallet Button */}
                <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} />
                  Import Wallet
                </Button>

                {/* Solana Wallets */}
                {solanaWallets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-white/40 mb-2.5 uppercase tracking-wider">Solana Wallets</h4>
                  <div className="flex flex-col gap-2">
                    {solanaWallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        draggable
                        onDragStart={() => handleDragStart(wallet.id)}
                        onDragOver={(e) => handleDragOver(e, wallet.id)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={() => setDragOverId(null)}
                        className={`bg-white/[0.03] rounded-lg p-3 border transition-colors cursor-grab active:cursor-grabbing ${
                          dragOverId === wallet.id ? 'border-blue-500/40 bg-blue-500/[0.04]' : 'border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <GripVertical size={14} className="text-white/15 flex-shrink-0 -ml-1" />
                          {/* Chef (dev) or Snipe (crosshair) icon */}
                          {wallet.isActive ? (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                              <line x1="6" y1="17" x2="18" y2="17" />
                              <line x1="9" y1="21" x2="15" y2="21" />
                              <line x1="9" y1="17" x2="9" y2="21" />
                              <line x1="15" y1="17" x2="15" y2="21" />
                            </svg>
                          ) : (
                            <svg className={`w-3.5 h-3.5 flex-shrink-0 ${block0Wallets[wallet.publicKey]?.enabled ? 'text-amber-400' : 'text-white/25'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="8" />
                              <line x1="12" y1="2" x2="12" y2="6" />
                              <line x1="12" y1="18" x2="12" y2="22" />
                              <line x1="2" y1="12" x2="6" y2="12" />
                              <line x1="18" y1="12" x2="22" y2="12" />
                            </svg>
                          )}
                          {wallet.isActive && (
                            <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-bold rounded uppercase">Dev</span>
                          )}
                          {!wallet.isActive && block0Wallets[wallet.publicKey]?.enabled && (
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400/80 text-[9px] font-bold rounded uppercase">Bundle</span>
                          )}
                          <p className="text-white/80 text-xs font-mono break-all flex-1">{wallet.publicKey}</p>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(wallet.publicKey)}>
                            <Copy size={12} />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteWallet(wallet.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400/80 text-xs font-semibold">{wallet.balance.toFixed(4)} SOL</span>
                          <div className="flex-1" />
                          {!wallet.isActive && (
                            <Button variant="secondary" size="sm" onClick={() => handleSetActive(wallet.id)}>
                              <svg className="w-3 h-3 mr-1 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                                <line x1="6" y1="17" x2="18" y2="17" />
                                <line x1="9" y1="21" x2="15" y2="21" />
                                <line x1="9" y1="17" x2="9" y2="21" />
                                <line x1="15" y1="17" x2="15" y2="21" />
                              </svg>
                              Set as Dev
                            </Button>
                          )}
                          {!wallet.isActive && (
                            <Button variant="secondary" size="sm" onClick={() => toggleBlock0(wallet.publicKey)}>
                              <svg className={`w-3 h-3 mr-1 ${block0Wallets[wallet.publicKey]?.enabled ? 'text-amber-400' : 'text-white/30'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="8" />
                                <line x1="12" y1="2" x2="12" y2="6" />
                                <line x1="12" y1="18" x2="12" y2="22" />
                                <line x1="2" y1="12" x2="6" y2="12" />
                                <line x1="18" y1="12" x2="22" y2="12" />
                              </svg>
                              {block0Wallets[wallet.publicKey]?.enabled ? 'Unbundle' : 'Set as Bundle'}
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowApiKey(showApiKey === wallet.id ? null : wallet.id)}
                          >
                            {showApiKey === wallet.id ? 'Hide Key' : 'Show Key'}
                          </Button>
                          <button
                            onClick={async () => {
                              const pool = getNoncePool(wallet.publicKey);
                              if (pool.length >= 3) {
                                setNonceStatus(prev => ({ ...prev, [wallet.id]: `Pool: ${pool.length} nonces ready` }));
                                return;
                              }
                              setNonceLoading(wallet.id);
                              setNonceStatus(prev => ({ ...prev, [wallet.id]: "Creating pool..." }));
                              try {
                                const service = getDeploymentService();
                                await service.connect();
                                const pk = getWalletPrivateKey(wallet.publicKey) || wallet.privateKey;
                                service.setupNonceAccount(
                                  wallet.publicKey,
                                  pk,
                                  (_nonceAccount, poolSize) => {
                                    setNonceLoading(null);
                                    setNonceStatus(prev => ({ ...prev, [wallet.id]: `Pool: ${poolSize} nonces ready` }));
                                  },
                                  (error) => {
                                    setNonceLoading(null);
                                    setNonceStatus(prev => ({ ...prev, [wallet.id]: `Error: ${error}` }));
                                  }
                                );
                              } catch (err) {
                                setNonceLoading(null);
                                setNonceStatus(prev => ({ ...prev, [wallet.id]: `Failed to connect` }));
                              }
                            }}
                            disabled={nonceLoading === wallet.id}
                            className={`px-2 py-1 rounded text-[10px] font-medium ${
                              getNoncePool(wallet.publicKey).length >= 3
                                ? 'bg-indigo-500/15 text-indigo-400'
                                : getNonceAccount(wallet.publicKey)
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-white/[0.06] hover:bg-indigo-500/15 text-white/40 hover:text-indigo-400'
                            } disabled:opacity-50`}
                          >
                            {nonceLoading === wallet.id ? "..." : getNoncePool(wallet.publicKey).length >= 3 ? `Turbo (${getNoncePool(wallet.publicKey).length})` : "Turbo"}
                          </button>
                        </div>
                        {showApiKey === wallet.id && (
                          <div className="mt-2 p-2 bg-black/30 rounded text-[10px] text-white/30 font-mono break-all border border-white/[0.04]">
                            {wallet.privateKey}
                          </div>
                        )}
                        {nonceStatus[wallet.id] && (
                          <p className={`mt-1 text-[10px] font-mono ${nonceStatus[wallet.id].startsWith("Error") || nonceStatus[wallet.id].startsWith("Failed") ? "text-red-400" : "text-emerald-400"}`}>
                            {nonceStatus[wallet.id]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* EVM Wallets */}
                {evmWallets.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-white/40 mb-2.5 uppercase tracking-wider">EVM Wallets</h4>
                  <div className="flex flex-col gap-2">
                    {evmWallets.map((wallet) => (
                      <div
                        key={wallet.id}
                        draggable
                        onDragStart={() => handleDragStart(wallet.id)}
                        onDragOver={(e) => handleDragOver(e, wallet.id)}
                        onDragEnd={handleDragEnd}
                        onDragLeave={() => setDragOverId(null)}
                        className={`bg-white/[0.03] rounded-lg p-3 border transition-colors cursor-grab active:cursor-grabbing ${
                          dragOverId === wallet.id ? 'border-blue-500/40 bg-blue-500/[0.04]' : 'border-white/[0.06]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <GripVertical size={14} className="text-white/15 flex-shrink-0 -ml-1" />
                          {wallet.isActive ? (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                              <line x1="6" y1="17" x2="18" y2="17" />
                              <line x1="9" y1="21" x2="15" y2="21" />
                              <line x1="9" y1="17" x2="9" y2="21" />
                              <line x1="15" y1="17" x2="15" y2="21" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 flex-shrink-0 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="8" />
                              <line x1="12" y1="2" x2="12" y2="6" />
                              <line x1="12" y1="18" x2="12" y2="22" />
                              <line x1="2" y1="12" x2="6" y2="12" />
                              <line x1="18" y1="12" x2="22" y2="12" />
                            </svg>
                          )}
                          {wallet.isActive && (
                            <span className="px-1.5 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-bold rounded uppercase">Dev</span>
                          )}
                          <p className="text-white/80 text-xs font-mono break-all flex-1">{wallet.publicKey}</p>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(wallet.publicKey)}>
                            <Copy size={12} />
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteWallet(wallet.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1" />
                          {!wallet.isActive && (
                            <Button variant="secondary" size="sm" onClick={() => handleSetActive(wallet.id)}>
                              <svg className="w-3 h-3 mr-1 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V17H6z" />
                                <line x1="6" y1="17" x2="18" y2="17" />
                                <line x1="9" y1="21" x2="15" y2="21" />
                                <line x1="9" y1="17" x2="9" y2="21" />
                                <line x1="15" y1="17" x2="15" y2="21" />
                              </svg>
                              Set as Dev
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowApiKey(showApiKey === wallet.id ? null : wallet.id)}
                          >
                            {showApiKey === wallet.id ? 'Hide Key' : 'Show Key'}
                          </Button>
                        </div>
                        {showApiKey === wallet.id && (
                          <div className="mt-2 p-2 bg-black/30 rounded text-[10px] text-white/30 font-mono break-all border border-white/[0.04]">
                            {wallet.privateKey}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}
              </div>
            </TabsContent>

            {/* Custom Presets Tab */}
            <TabsContent value="custom-presets" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-4">
                {/* Action Buttons Row */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => setShowPresetForm(true)}
                  >
                    + New Preset
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const dataStr = JSON.stringify(presets, null, 2);
                      const dataBlob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `custom-presets-${Date.now()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download size={12} /> Export
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'application/json';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            try {
                              const importedPresets = JSON.parse(event.target?.result as string);
                              if (Array.isArray(importedPresets)) {
                                const newPresets = importedPresets.map(p => ({
                                  ...p,
                                  id: Date.now().toString() + Math.random()
                                }));
                                onPresetsChange([...presets, ...newPresets]);
                                alert(`Imported ${newPresets.length} preset(s)`);
                              } else {
                                alert('Invalid preset file');
                              }
                            } catch (error) {
                              alert('Failed to parse file');
                            }
                          };
                          reader.readAsText(file);
                        }
                      };
                      input.click();
                    }}
                  >
                    <UploadCloud size={12} /> Import
                  </Button>
                </div>

                {/* Presets List */}
                {presets.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {presets.map((preset) => (
                      <div key={preset.id} className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06] flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-xs font-semibold truncate">{preset.name}</span>
                            {preset.keybind && <span className="text-blue-400 text-[10px] font-mono bg-blue-500/10 px-1.5 py-0.5 rounded">{preset.keybind}</span>}
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-white/35">
                            {preset.namePrefix && <span>Prefix: <span className="text-white/60">{preset.namePrefix}</span></span>}
                            {preset.nameSuffix && <span>Suffix: <span className="text-white/60">{preset.nameSuffix}</span></span>}
                            <span>{preset.deployPlatform}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const duplicatedPreset = { ...preset, id: Date.now().toString(), name: `${preset.name} (Copy)`, keybind: '' };
                              onPresetsChange([...presets, duplicatedPreset]);
                            }}
                          >
                            <Copy size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditingPresetId(preset.id); setNewPreset(preset); setShowPresetForm(true); }}
                          >
                            <Settings size={12} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon"
                            onClick={() => onPresetsChange(presets.filter(p => p.id !== preset.id))}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {presets.length === 0 && (
                  <div className="text-center py-8 text-white/20 text-xs">No presets yet</div>
                )}
              </div>
            </TabsContent>

            {/* Insta-Deploy Tab */}
            <TabsContent value="insta-deploy" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                {/* Auto-Deploy Keybind Section */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Primary Keybind</h3>
                  <p className="text-white/20 text-[10px] mb-3">
                    Keyboard shortcut for quick deploy with selected text
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIsCapturingPrimary(true);
                        const handleKeyPress = (e: KeyboardEvent) => {
                          e.preventDefault();
                          if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
                          const modifiers = [];
                          if (e.ctrlKey) modifiers.push('Ctrl');
                          if (e.altKey) modifiers.push('Alt');
                          if (e.shiftKey) modifiers.push('Shift');
                          if (e.metaKey) modifiers.push('Meta');
                          const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                          const keybind = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${key}` : key;
                          setPrimaryKeybind(keybind);
                          setIsCapturingPrimary(false);
                          document.removeEventListener('keydown', handleKeyPress);
                        };
                        document.addEventListener('keydown', handleKeyPress);
                        setTimeout(() => {
                          if (isCapturingPrimary) {
                            setIsCapturingPrimary(false);
                            document.removeEventListener('keydown', handleKeyPress);
                          }
                        }, 5000);
                      }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-mono font-bold transition-all ${
                        isCapturingPrimary
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1] border border-white/[0.06]'
                      }`}
                    >
                      {isCapturingPrimary ? 'Press key...' : primaryKeybind}
                    </button>
                  </div>
                </div>

                {/* Secondary Keybind */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Secondary Keybind</h3>
                  <p className="text-white/20 text-[10px] mb-3">Optional second shortcut</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setIsCapturingSecondary(true);
                        const handleKeyPress = (e: KeyboardEvent) => {
                          e.preventDefault();
                          if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
                          const modifiers = [];
                          if (e.ctrlKey) modifiers.push('Ctrl');
                          if (e.altKey) modifiers.push('Alt');
                          if (e.shiftKey) modifiers.push('Shift');
                          if (e.metaKey) modifiers.push('Meta');
                          const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                          const keybind = modifiers.length > 0 ? `${modifiers.join(' + ')} + ${key}` : key;
                          setSecondaryKeybind(keybind);
                          setIsCapturingSecondary(false);
                          document.removeEventListener('keydown', handleKeyPress);
                        };
                        document.addEventListener('keydown', handleKeyPress);
                        setTimeout(() => {
                          if (isCapturingSecondary) {
                            setIsCapturingSecondary(false);
                            document.removeEventListener('keydown', handleKeyPress);
                          }
                        }, 5000);
                      }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-mono font-bold transition-all ${
                        isCapturingSecondary
                          ? 'bg-blue-600 text-white animate-pulse'
                          : 'bg-white/[0.06] text-white/70 hover:bg-white/[0.1] border border-white/[0.06]'
                      }`}
                    >
                      {isCapturingSecondary ? 'Press key...' : (secondaryKeybind || 'None')}
                    </button>
                  </div>
                </div>

                {/* Double-click */}
                <div className="border-t border-white/[0.06] pt-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doubleClickEnabled}
                      onChange={(e) => setDoubleClickEnabled(e.target.checked)}
                      className="w-4 h-4 rounded bg-white/[0.06] border-white/[0.1] text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-white/70 text-xs font-medium">Double-click to deploy</span>
                  </label>
                </div>

                {/* AI Fill Modifier */}
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">AI Pick Fill Modifier</h3>
                  <p className="text-white/20 text-[10px] mb-3">
                    Hold this key + click an AI suggestion to fill the form instead of deploying
                  </p>
                  <div className="flex items-center gap-2">
                    {['Alt', 'Ctrl', 'Shift'].map(mod => (
                      <button
                        key={mod}
                        onClick={() => setAiFillModifier(mod)}
                        className={`px-3 py-1.5 rounded text-[11px] font-mono font-bold transition-all border ${
                          aiFillModifier === mod
                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                            : 'bg-white/[0.04] text-white/40 border-white/[0.06] hover:text-white/60'
                        }`}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 mt-2">
                  <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-2">How it works</p>
                  <ul className="text-white/35 space-y-1 text-[10px]">
                    <li>Highlight text from any tweet, press keybind to deploy</li>
                    <li>One word = name + ticker, multiple words = auto-abbreviation</li>
                    <li>Automatically pulls tweet link and image</li>
                    <li><span className="text-white/50">{aiFillModifier}+click</span> AI pick = fill form + search (no deploy)</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Quick Buy Tab */}
            <TabsContent value="quick-buy" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                {/* SOL Preset Amounts */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">SOL Quick Buy Buttons</h3>
                  <p className="text-white/20 text-[10px] mb-3">5 preset amounts shown below the deploy form</p>
                  <div className="flex gap-2">
                    {solPresets.map((val, i) => (
                      <Input
                        key={i}
                        type="text"
                        value={val}
                        onChange={(e) => { const n = [...solPresets]; n[i] = e.target.value; setSolPresets(n); }}
                        className="flex-1 bg-white/[0.04] border-white/[0.06] text-xs font-mono text-center"
                        placeholder={`Btn ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSolPresets(['1', '2', '3', '4', '5'])}
                    >
                      Reset defaults
                    </Button>
                  </div>
                </div>

                {/* USD1 Preset Amounts */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">USD1 Quick Buy Buttons</h3>
                  <p className="text-white/20 text-[10px] mb-3">Preset amounts for USD1 mode</p>
                  <div className="flex gap-2">
                    {usd1Presets.map((val, i) => (
                      <Input
                        key={i}
                        type="text"
                        value={val}
                        onChange={(e) => { const n = [...usd1Presets]; n[i] = e.target.value; setUsd1Presets(n); }}
                        className="flex-1 bg-white/[0.04] border-white/[0.06] text-xs font-mono text-center"
                        placeholder={`Btn ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUsd1Presets(['50', '100', '250', '500', '1000'])}
                    >
                      Reset defaults
                    </Button>
                  </div>
                </div>

                {/* Bundle SOL Preset Amounts */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Bundle SOL Quick Buy</h3>
                  <p className="text-white/20 text-[10px] mb-3">5 preset amounts for bundle deploy mode</p>
                  <div className="flex gap-2">
                    {bundleSolPresets.map((val, i) => (
                      <Input
                        key={i}
                        type="text"
                        value={val}
                        onChange={(e) => { const n = [...bundleSolPresets]; n[i] = e.target.value; setBundleSolPresets(n); }}
                        className="flex-1 bg-white/[0.04] border-white/[0.06] text-xs font-mono text-center"
                        placeholder={`Btn ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBundleSolPresets(['0.5', '1', '2', '3', '5'])}
                    >
                      Reset defaults
                    </Button>
                  </div>
                </div>

                {/* Bundle USD1 Preset Amounts */}
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Bundle USD1 Quick Buy</h3>
                  <p className="text-white/20 text-[10px] mb-3">Preset amounts for bundle USD1 mode</p>
                  <div className="flex gap-2">
                    {bundleUsd1Presets.map((val, i) => (
                      <Input
                        key={i}
                        type="text"
                        value={val}
                        onChange={(e) => { const n = [...bundleUsd1Presets]; n[i] = e.target.value; setBundleUsd1Presets(n); }}
                        className="flex-1 bg-white/[0.04] border-white/[0.06] text-xs font-mono text-center"
                        placeholder={`Btn ${i + 1}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBundleUsd1Presets(['50', '100', '250', '500', '1000'])}
                    >
                      Reset defaults
                    </Button>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4 space-y-4">
                  {/* Default SOL Amount */}
                  <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Default SOL Buy Amount</h3>
                    <p className="text-white/20 text-[10px] mb-2">Amount used for Deploy button and keybind deploys</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={defaultSolAmount}
                        onChange={(e) => setDefaultSolAmount(e.target.value)}
                        className="w-32 bg-white/[0.04] border-white/[0.06] text-xs font-mono"
                      />
                      <span className="text-white/25 text-[10px]">SOL</span>
                    </div>
                  </div>

                  {/* Default USD1 Amount */}
                  <div>
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Default USD1 Buy Amount</h3>
                    <p className="text-white/20 text-[10px] mb-2">Amount used for USD1 mode deploys</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={defaultUsd1Amount}
                        onChange={(e) => setDefaultUsd1Amount(e.target.value)}
                        className="w-32 bg-white/[0.04] border-white/[0.06] text-xs font-mono"
                      />
                      <span className="text-white/25 text-[10px]">USD1</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-2">Info</p>
                  <ul className="text-white/35 space-y-1 text-[10px]">
                    <li>Quick buy buttons appear at the bottom of the deploy panel</li>
                    <li>Click a button to deploy instantly with that SOL/USD1 amount</li>
                    <li>You can also edit amounts inline by clicking the gear icon</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Auto-Deploy Tab */}
            <TabsContent value="auto-deploy" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Auto-Deploy on Paste</h3>
                  <p className="text-white/20 text-[10px] mb-3">Automatically deploy when pasting a Twitter/X URL</p>
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={autoDeployOnPaste}
                      onCheckedChange={setAutoDeployOnPaste}
                    />
                    <span className="text-white/70 text-xs font-medium">Enable auto-deploy on paste</span>
                  </div>
                </div>

                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Default AI Deploy Platform</h3>
                  <p className="text-white/20 text-[10px] mb-3">Platform used when clicking AI suggestion cards</p>
                  <div className="flex gap-2">
                    {[
                      { id: 'pump', label: 'Pump', img: '/images/pump-logo.png' },
                      { id: 'bonk', label: 'Bonk', img: '/images/bonk-logo.png' },
                      { id: 'usd1', label: 'USD1', img: '/images/usd1-logo.png' },
                      { id: 'bags', label: 'Bags', img: '/images/bags-logo.png' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setDefaultAiPlatform(p.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          defaultAiPlatform === p.id
                            ? 'border-blue-500 bg-blue-500/15 text-white'
                            : 'border-white/[0.06] bg-white/[0.04] text-white/50 hover:border-white/15'
                        }`}
                      >
                        <img src={p.img} alt={p.label} className="w-4 h-4 object-contain" />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-2">How it works</p>
                  <ul className="text-white/35 space-y-1 text-[10px]">
                    <li>AI analyzes pasted tweets and suggests token names</li>
                    <li>Click an AI suggestion card to deploy with the default platform</li>
                    <li>Or click a specific platform icon on the card to override</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Button Tab — Deploy button position & scale */}
            <TabsContent value="button" className="flex-1 overflow-y-auto p-5">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Deploy Button Position</h3>
                  <p className="text-white/20 text-[10px] mb-3">Where the deploy button appears on each tweet</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { id: 'left' as const, label: 'Left Side', desc: 'Vertical strip, left edge' },
                      { id: 'right' as const, label: 'Right Side', desc: 'Vertical strip, right edge' },
                      { id: 'top-right' as const, label: 'Top Right', desc: 'Floating corner button' },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setDeployBtnPosition(opt.id)}
                        className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                          deployBtnPosition === opt.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                        }`}
                      >
                        {/* Mini preview */}
                        <div className="w-full h-16 rounded bg-white/[0.03] border border-white/[0.06] relative overflow-hidden">
                          <div className="absolute top-1.5 left-2 flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-white/10" />
                            <div className="w-8 h-1.5 rounded bg-white/10" />
                          </div>
                          <div className="absolute top-5 left-2 right-2 h-1 rounded bg-white/[0.05]" />
                          <div className="absolute top-7.5 left-2 right-4 h-1 rounded bg-white/[0.05]" />
                          {/* Deploy button position indicator */}
                          {opt.id === 'left' && (
                            <div className="absolute left-0 top-0 bottom-0 w-[10px] flex items-center justify-center bg-blue-600/60 rounded-l text-[4px] text-white font-bold" style={{ writingMode: 'vertical-rl' }}>D</div>
                          )}
                          {opt.id === 'right' && (
                            <div className="absolute right-0 top-0 bottom-0 w-[10px] flex items-center justify-center bg-blue-600/60 rounded-r text-[4px] text-white font-bold" style={{ writingMode: 'vertical-rl' }}>D</div>
                          )}
                          {opt.id === 'top-right' && (
                            <div className="absolute right-1 top-1 px-1.5 py-1 bg-blue-600/60 rounded text-[5px] text-white font-bold">DEPLOY</div>
                          )}
                        </div>
                        <div className="text-center">
                          <span className={`text-xs font-medium block ${deployBtnPosition === opt.id ? 'text-white' : 'text-white/60'}`}>{opt.label}</span>
                          <span className="text-[10px] text-white/25">{opt.desc}</span>
                        </div>
                        {deployBtnPosition === opt.id && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scale slider — only shown for top-right */}
                {deployBtnPosition === 'top-right' && (
                  <div className="border-t border-white/[0.06] pt-4">
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Button Scale</h3>
                    <p className="text-white/20 text-[10px] mb-3">Adjust the size of the floating deploy button</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={60}
                        max={200}
                        value={deployBtnScale}
                        onChange={(e) => setDeployBtnScale(parseInt(e.target.value, 10))}
                        className="flex-1 h-1.5 rounded-full appearance-none bg-white/[0.08] accent-blue-500 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md"
                      />
                      <span className="text-white/50 text-xs font-mono w-10 text-right">{deployBtnScale}%</span>
                    </div>
                    {/* Preview */}
                    <div className="mt-4 flex items-center gap-3">
                      <span className="text-white/25 text-[10px]">Preview:</span>
                      <button
                        className="px-3 py-1.5 bg-blue-600/70 text-white font-semibold rounded-md transition-all"
                        style={{ fontSize: `${11 * deployBtnScale / 100}px`, transform: `scale(${deployBtnScale / 100})`, transformOrigin: 'left center' }}
                      >
                        DEPLOY
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">AI Highlight Deploy Mode</h3>
                  <p className="text-white/20 text-[10px] mb-3">How the green highlighted text in the feed deploys tokens</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: 'hold' as const, label: 'Hold & Release', desc: 'Hold mouse, pick image, release to deploy' },
                      { id: 'click' as const, label: 'Click to Deploy', desc: 'Click text, then click an image to deploy' },
                    ]).map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setAiClickMode(opt.id)}
                        className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                          aiClickMode === opt.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                        }`}
                      >
                        <span className={`text-xs font-medium ${aiClickMode === opt.id ? 'text-white' : 'text-white/60'}`}>{opt.label}</span>
                        <span className="text-[10px] text-white/25 text-center">{opt.desc}</span>
                        {aiClickMode === opt.id && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                  <p className="text-white/25 text-[10px] font-semibold uppercase tracking-wider mb-2">Info</p>
                  <ul className="text-white/35 space-y-1 text-[10px]">
                    <li>Left / Right Side: vertical deploy strip on the edge of each tweet</li>
                    <li>Top Right: floating button with adjustable scale</li>
                    <li>Hold & Release: press on green text, hover over an image, release to deploy</li>
                    <li>Click to Deploy: click green text to show images, click an image to deploy</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Extensions Tab — still coming soon */}
            <TabsContent value="extensions" className="flex-1 overflow-y-auto p-5">
              <div className="text-center text-white/20 py-10">
                <p className="text-xs">Coming soon</p>
                <p className="text-[10px] mt-2 text-white/10">Browser extensions, webhook integrations, and custom scripts</p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Custom Preset Form Modal */}
      <Dialog open={showPresetForm} onOpenChange={(open) => {
        if (!open) {
          setShowPresetForm(false);
          setEditingPresetId(null);
          setNewPreset({ id: '', name: '', namePrefix: '', nameSuffix: '', deployPlatform: 'Use Account Default', tickerMode: 'Selected Text', imageType: 'Image in Post', keybind: '' });
          setIsCapturingKeybind(false);
        }
      }}>
        <DialogContent className={`max-w-md p-5 ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <h3 className="text-sm font-semibold text-white/80 mb-4">{editingPresetId ? 'Edit Preset' : 'New Preset'}</h3>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Name</label>
              <Input
                type="text"
                placeholder="e.g., COIN OF AMERICA"
                value={newPreset.name}
                onChange={(e) => setNewPreset({...newPreset, name: e.target.value})}
                className="bg-white/[0.04] border-white/[0.06]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Prefix</label>
                <Input
                  type="text"
                  placeholder="e.g., Justice For"
                  value={newPreset.namePrefix}
                  onChange={(e) => setNewPreset({...newPreset, namePrefix: e.target.value})}
                  className="bg-white/[0.04] border-white/[0.06]"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Suffix</label>
                <Input
                  type="text"
                  placeholder="e.g., ification"
                  value={newPreset.nameSuffix}
                  onChange={(e) => setNewPreset({...newPreset, nameSuffix: e.target.value})}
                  className="bg-white/[0.04] border-white/[0.06]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Platform</label>
                <Select
                  value={newPreset.deployPlatform}
                  onValueChange={(value) => setNewPreset({...newPreset, deployPlatform: value})}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Use Account Default">Use Account Default</SelectItem>
                    <SelectItem value="Pump.fun">Pump.fun</SelectItem>
                    <SelectItem value="Jupiter">Jupiter</SelectItem>
                    <SelectItem value="Binance">Binance</SelectItem>
                    <SelectItem value="USD1">USD1</SelectItem>
                    <SelectItem value="BONK">BONK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Ticker</label>
                <Select
                  value={newPreset.tickerMode}
                  onValueChange={(value) => setNewPreset({...newPreset, tickerMode: value})}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Selected Text">Selected Text</SelectItem>
                    <SelectItem value="Abbreviation">Abbreviation</SelectItem>
                    <SelectItem value="First Word">First Word</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Image</label>
                <Select
                  value={newPreset.imageType}
                  onValueChange={(value) => setNewPreset({...newPreset, imageType: value})}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.06] text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Image in Post">Image in Post</SelectItem>
                    <SelectItem value="ASCII Art">ASCII Art</SelectItem>
                    <SelectItem value="SOL ASCII (Gradient)">SOL ASCII (Gradient)</SelectItem>
                    <SelectItem value="Letter Image">Letter Image</SelectItem>
                    <SelectItem value="Custom Image">Custom Image</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newPreset.imageType === 'Custom Image' && (
              <div>
                <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Image URL</label>
                <Input
                  type="text"
                  placeholder="https://example.com/image.png"
                  value={newPreset.customImageUrl || ''}
                  onChange={(e) => setNewPreset({...newPreset, customImageUrl: e.target.value})}
                  className="bg-white/[0.04] border-white/[0.06]"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Keybind</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsCapturingKeybind(true);
                    const handleKeyPress = (e: KeyboardEvent) => {
                      e.preventDefault();
                      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
                      const key = e.key.toUpperCase();
                      const modifiers = [];
                      if (e.ctrlKey) modifiers.push('Ctrl');
                      if (e.altKey) modifiers.push('Alt');
                      if (e.shiftKey) modifiers.push('Shift');
                      const keybind = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
                      setNewPreset({...newPreset, keybind});
                      setIsCapturingKeybind(false);
                      document.removeEventListener('keydown', handleKeyPress);
                    };
                    document.addEventListener('keydown', handleKeyPress);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
                    isCapturingKeybind ? 'bg-blue-600 text-white animate-pulse' : 'bg-white/[0.04] text-white/60 border border-white/[0.06] hover:bg-white/[0.08]'
                  }`}
                >
                  {isCapturingKeybind ? 'Press key...' : (newPreset.keybind || 'Not Set')}
                </button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setNewPreset({...newPreset, keybind: ''})}
                  className="bg-red-500/15 hover:bg-red-500/25 text-red-400"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setShowPresetForm(false);
                setEditingPresetId(null);
                setNewPreset({ id: '', name: '', namePrefix: '', nameSuffix: '', deployPlatform: 'Use Account Default', tickerMode: 'Selected Text', imageType: 'Image in Post', keybind: '' });
                setIsCapturingKeybind(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                if (newPreset.name) {
                  if (editingPresetId) {
                    const updatedPresets = presets.map(p => p.id === editingPresetId ? { ...newPreset, id: editingPresetId } : p);
                    onPresetsChange(updatedPresets);
                  } else {
                    const preset = { ...newPreset, id: Date.now().toString() };
                    onPresetsChange([...presets, preset]);
                  }
                  setShowPresetForm(false);
                  setEditingPresetId(null);
                  setNewPreset({ id: '', name: '', namePrefix: '', nameSuffix: '', deployPlatform: 'Use Account Default', tickerMode: 'Selected Text', imageType: 'Image in Post', keybind: '' });
                }
              }}
            >
              {editingPresetId ? 'Update' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Wallet Modal */}
      <Dialog open={showImportModal} onOpenChange={(open) => {
        if (!open) { setShowImportModal(false); setPrivateKeyInput(""); }
      }}>
        <DialogContent className={`max-w-sm p-5 ${theme.panel1ContentBg} border-white/[0.08]`} hideClose>
          <h3 className="text-sm font-semibold text-white/80 mb-4">Import Wallet</h3>

          <div className="mb-3">
            <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Type</label>
            <div className="flex gap-1.5">
              <Button
                className={`flex-1 ${
                  importType === 'solana'
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
                }`}
                variant={importType === 'solana' ? 'default' : 'secondary'}
                onClick={() => setImportType('solana')}
              >
                Solana
              </Button>
              <Button
                className={`flex-1 ${
                  importType === 'evm'
                    ? 'bg-purple-600 text-white hover:bg-purple-500'
                    : 'bg-white/[0.04] text-white/40 border border-white/[0.06] hover:bg-white/[0.08]'
                }`}
                variant={importType === 'evm' ? 'default' : 'secondary'}
                onClick={() => setImportType('evm')}
              >
                EVM
              </Button>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-1 block">Private Key</label>
            <textarea
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleImportWallet();
                }
              }}
              placeholder="Enter your private key..."
              className="w-full bg-white/[0.04] text-white px-3 py-2 rounded-lg border border-white/[0.06] text-xs focus:outline-none focus:border-blue-500 min-h-[80px] font-mono placeholder-white/20 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => { setShowImportModal(false); setPrivateKeyInput(""); }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleImportWallet}
            >
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
