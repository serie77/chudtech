import { storeGet, storeSet } from "@/lib/store";

// 222gazer WebSocket deploy client (raw WebSocket)
const REGIONS: Record<string, { url: string; param: string }> = {
  eu: { url: "wss://eu.222gazer.xyz", param: "europe" },
  na: { url: "wss://na.222gazer.xyz", param: "na" },
};

function getRegion(): { url: string; param: string } {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('chud-region');
    if (saved && REGIONS[saved]) return REGIONS[saved];
  }
  return REGIONS.eu;
}

/** Returns the current region key ('eu' or 'na') for namespacing localStorage */
export function getRegionKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('chud-region');
    if (saved && REGIONS[saved]) return saved;
  }
  return 'eu';
}

const API_KEY = "biscuits";
const DEPLOY_TIMEOUT = 60_000;

// XOR obfuscation — same as 222 extension (not crypto-grade, prevents plaintext storage)
const KEY_SALT = "222-local-mode-v1";

function obfuscateKey(plainKey: string): string {
  let result = "";
  for (let i = 0; i < plainKey.length; i++) {
    result += String.fromCharCode(plainKey.charCodeAt(i) ^ KEY_SALT.charCodeAt(i % KEY_SALT.length));
  }
  return btoa(result);
}

function deobfuscateKey(obfuscated: string): string {
  const decoded = atob(obfuscated);
  let result = "";
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded.charCodeAt(i) ^ KEY_SALT.charCodeAt(i % KEY_SALT.length));
  }
  return result;
}

// ── Wallet storage (localStorage, same pattern as 222 extension) ──

export interface StoredWallet {
  publicKey: string;
  encryptedPrivateKey: string; // XOR obfuscated + base64
  name: string;
}

export function saveWallet(publicKey: string, privateKey: string, name: string): void {
  const wallets = getStoredWallets();
  // Don't duplicate
  if (wallets.some(w => w.publicKey === publicKey)) return;
  wallets.push({ publicKey, encryptedPrivateKey: obfuscateKey(privateKey), name });
  storeSet(`local_wallets_${getRegionKey()}`, JSON.stringify(wallets));
}

export function getStoredWallets(): StoredWallet[] {
  try {
    const raw = storeGet(`local_wallets_${getRegionKey()}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeWallet(publicKey: string): void {
  const wallets = getStoredWallets().filter(w => w.publicKey !== publicKey);
  storeSet(`local_wallets_${getRegionKey()}`, JSON.stringify(wallets));
}

export function getWalletPrivateKey(publicKey: string): string | null {
  const wallet = getStoredWallets().find(w => w.publicKey === publicKey);
  if (!wallet) return null;
  return deobfuscateKey(wallet.encryptedPrivateKey);
}

// ── Nonce account storage (pool: array of nonce pubkeys per wallet) ──

export function getNonceAccounts(): Record<string, string[]> {
  try {
    const raw = storeGet(`nonce_accounts_${getRegionKey()}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // Migrate old format: { wallet: "singleNonce" } → { wallet: ["singleNonce"] }
    const result: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(parsed)) {
      result[k] = Array.isArray(v) ? v as string[] : [v as string];
    }
    return result;
  } catch {
    return {};
  }
}

/** Returns first nonce pubkey (for backward compat checks like "has nonce?") */
export function getNonceAccount(walletPubkey: string): string | null {
  const pool = getNonceAccounts()[walletPubkey];
  return pool?.[0] || null;
}

/** Returns full nonce pool for a wallet */
export function getNoncePool(walletPubkey: string): string[] {
  return getNonceAccounts()[walletPubkey] || [];
}

export function saveNoncePool(walletPubkey: string, nonceAccounts: string[]): void {
  const accounts = getNonceAccounts();
  accounts[walletPubkey] = nonceAccounts;
  storeSet(`nonce_accounts_${getRegionKey()}`, JSON.stringify(accounts));
}

/** @deprecated Use saveNoncePool for new code */
export function saveNonceAccount(walletPubkey: string, nonceAccount: string): void {
  const existing = getNoncePool(walletPubkey);
  if (!existing.includes(nonceAccount)) {
    existing.push(nonceAccount);
  }
  saveNoncePool(walletPubkey, existing);
}

export function removeNonceAccount(walletPubkey: string): void {
  const accounts = getNonceAccounts();
  delete accounts[walletPubkey];
  storeSet(`nonce_accounts_${getRegionKey()}`, JSON.stringify(accounts));
}

// ── Deploy types ──

export interface SnipeWallet {
  publicKey: string;
  privateKey: string;
  amount: number;
}

export interface CreateTokenParams {
  platform: "pump" | "bonk" | "usd1" | "bags";
  name: string;
  symbol: string;
  image: string;
  amount: number;
  wallet: {
    publicKey: string;
    privateKey: string;
  };
  website?: string;
  twitter?: string;
  description?: string;
  currency?: "SOL" | "USD1";
  isBonkersEnabled?: boolean;
  isCashbackEnabled?: boolean;
  bundleEnabled?: boolean;
  turboModeEnabled?: boolean;
  snipeWallets?: SnipeWallet[];
  autoSell?: boolean;
  autoSellAll?: boolean;
  autoSellDelay?: number;
  multiDeploy?: boolean;
  multiDeployCount?: number;
  multiDeploySecondaryAmount?: number;
}

export interface TokenCreatedResponse {
  mint: string;
  signature?: string;
  bondingCurve?: string;
  pool?: string;
  metadataUri?: string;
}

export interface TokenErrorResponse {
  error: string;
}

// Map frontend platform names to 222gazer server names
function mapPlatform(platform: string): string {
  switch (platform) {
    case "pump": return "pumpfun";
    case "usd1": return "launchlab";
    case "bonk": return "bonk";
    case "bags": return "bags";
    default: return "pumpfun";
  }
}

function mapCurrency(platform: string, override?: "SOL" | "USD1"): string {
  if (override) return override;
  return platform === "usd1" ? "USD1" : "SOL";
}

// ── WebSocket deploy service ──

export class TokenDeploymentService {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(connected: boolean) => void> = [];

  // ── Auto-connect + reconnect (mirrors 222 extension) ──

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Already open — resolve instantly
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      // Close stale socket
      if (this.ws) {
        try { this.ws.close(); } catch {}
        this.ws = null;
      }

      const region = getRegion();
      const url = `${region.url}/?api_key=${encodeURIComponent(API_KEY)}&region=${region.param}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        if (!this.connected) {
          this.ws?.close();
          reject(new Error("Connection timeout"));
        }
      }, 10_000);

      this.ws.onopen = () => {
        this.connected = true;
        clearTimeout(timeout);

        // Clear any pending reconnect
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Enable Rust deploy mode on connect
        this.ws?.send(JSON.stringify({ command: "set_rust_deploy", enabled: true }));
        this.startPing();
        this.broadcastStatus(true);
        console.log("[222] Connected to deploy server (Rust deploy enabled)");
        resolve();
      };

      this.ws.onerror = (e) => {
        clearTimeout(timeout);
        console.error("[222] WebSocket error:", e);
        reject(new Error("WebSocket connection failed"));
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.stopPing();
        this.broadcastStatus(false);
        console.log("[222] Disconnected");
        this.scheduleReconnect();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.command === "pong") return; // heartbeat ack
        } catch {}
      };
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return; // only one at a time
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log("[222] Attempting reconnect...");
      this.connect().catch(() => {}); // will re-schedule on next close
    }, 5_000);
  }

  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ command: "ping" }));
      }
    }, 30_000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Status listeners so UI can react to connect/disconnect
  onStatusChange(cb: (connected: boolean) => void): () => void {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }

  private broadcastStatus(connected: boolean): void {
    this.listeners.forEach(cb => cb(connected));
  }

  createToken(
    params: CreateTokenParams,
    onSuccess: (data: TokenCreatedResponse) => void,
    onError: (error: string) => void
  ): void {
    if (!this.ws || !this.connected) {
      onError("Not connected to deploy server.");
      return;
    }

    const apiPlatform = mapPlatform(params.platform);
    const message = {
      command: "deploy",
      platform: apiPlatform,
      currency: mapCurrency(params.platform, params.currency),
      name: params.name,
      symbol: params.symbol,
      image: params.image,
      description: params.description || "",
      website: params.website || "",
      twitter: params.twitter || "",
      telegram: "",
      buyAmount: params.amount,
      wallet: {
        publicKey: params.wallet.publicKey,
        privateKey: params.wallet.privateKey,
      },
      isBonkersEnabled: (apiPlatform === 'bonk' || apiPlatform === 'launchlab') ? (params.isBonkersEnabled || false) : false,
      isMayhemMode: false,
      isCashbackEnabled: apiPlatform === 'pumpfun' ? (params.isCashbackEnabled || false) : false,
      autoSell: params.autoSell || false,
      autoSellAll: params.autoSellAll || false,
      autoSellDelay: params.autoSellDelay || 0,
      bundleEnabled: params.bundleEnabled || false,
      turboModeEnabled: params.turboModeEnabled !== false,
      existing_nonce_account: params.turboModeEnabled !== false ? getNoncePool(params.wallet.publicKey) : undefined,
      snipeWallets: params.snipeWallets || [],
    };

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.command !== "deploy_response") return;

        this.ws?.removeEventListener("message", handler);
        clearTimeout(timeout);

        if (data.success) {
          console.log("[222] Deploy success:", data.mint);
          onSuccess({
            mint: data.mint,
            signature: data.signature,
            bondingCurve: data.bondingCurve,
            pool: data.pool,
            metadataUri: data.metadataUri,
          });
        } else {
          console.error("[222] Deploy failed:", data.error);
          onError(data.error || "Deploy failed");
        }
      } catch {}
    };

    this.ws.addEventListener("message", handler);

    const timeout = setTimeout(() => {
      this.ws?.removeEventListener("message", handler);
      onError("Deploy timed out (60s)");
    }, DEPLOY_TIMEOUT);

    const { wallet: _w, image: _i, ...logSafe } = message;
    console.log("[222] Deploy payload:", JSON.stringify(logSafe, null, 2));
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Multi-deploy: send first deploy, wait for success, then fire remaining in parallel.
   * Same pattern as flash-deploy multi mode.
   */
  createTokenMulti(
    params: CreateTokenParams,
    count: number,
    secondaryAmount: number,
    onProgress: (completed: number, total: number, successes: number) => void,
    onDone: (results: { success: boolean; mint?: string; error?: string }[]) => void
  ): void {
    if (!this.ws || !this.connected) {
      onDone([{ success: false, error: "Not connected to deploy server." }]);
      return;
    }

    const total = Math.min(10, Math.max(1, count));
    const results: { success: boolean; mint?: string; error?: string }[] = [];

    const sendOneDeploy = (amount: number): Promise<{ success: boolean; mint?: string; error?: string }> => {
      return new Promise((resolve) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          resolve({ success: false, error: "WebSocket disconnected" });
          return;
        }

        const apiPlatform = mapPlatform(params.platform);
        const message = {
          command: "deploy",
          platform: apiPlatform,
          currency: mapCurrency(params.platform, params.currency),
          name: params.name,
          symbol: params.symbol,
          image: params.image,
          description: params.description || "",
          website: params.website || "",
          twitter: params.twitter || "",
          telegram: "",
          buyAmount: amount,
          wallet: {
            publicKey: params.wallet.publicKey,
            privateKey: params.wallet.privateKey,
          },
          isBonkersEnabled: (apiPlatform === 'bonk' || apiPlatform === 'launchlab') ? (params.isBonkersEnabled || false) : false,
          isMayhemMode: false,
          isCashbackEnabled: apiPlatform === 'pumpfun' ? (params.isCashbackEnabled || false) : false,
          autoSell: params.autoSell || false,
          autoSellAll: params.autoSellAll || false,
          autoSellDelay: params.autoSellDelay || 0,
          bundleEnabled: params.bundleEnabled || false,
          snipeWallets: params.snipeWallets || [],
        };

        const handler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.command !== "deploy_response") return;
            this.ws?.removeEventListener("message", handler);
            clearTimeout(timeout);
            if (data.success) {
              resolve({ success: true, mint: data.mint });
            } else {
              resolve({ success: false, error: data.error || "Deploy failed" });
            }
          } catch {}
        };

        this.ws!.addEventListener("message", handler);
        const timeout = setTimeout(() => {
          this.ws?.removeEventListener("message", handler);
          resolve({ success: false, error: "Deploy timed out (60s)" });
        }, DEPLOY_TIMEOUT);

        this.ws!.send(JSON.stringify(message));
      });
    };

    // Deploy #1 with main amount, then fire rest in parallel with secondary amount
    (async () => {
      const mainResult = await sendOneDeploy(params.amount);
      results.push(mainResult);
      onProgress(1, total, mainResult.success ? 1 : 0);

      if (!mainResult.success || total === 1) {
        onDone(results);
        return;
      }

      // Fire remaining deploys in parallel
      const secondaryPromises: Promise<{ success: boolean; mint?: string; error?: string }>[] = [];
      for (let i = 1; i < total; i++) {
        secondaryPromises.push(sendOneDeploy(secondaryAmount));
      }

      const secondaryResults = await Promise.all(secondaryPromises);
      results.push(...secondaryResults);
      const successes = results.filter(r => r.success).length;
      onProgress(total, total, successes);
      onDone(results);
    })();
  }

  setupNonceAccount(
    publicKey: string,
    privateKey: string,
    onSuccess: (nonceAccount: string, poolSize: number) => void,
    onError: (error: string) => void
  ): void {
    if (!this.ws || !this.connected) {
      onError("Not connected to deploy server.");
      return;
    }

    // Check if pool already exists locally
    const existingPool = getNoncePool(publicKey);
    if (existingPool.length >= 3) {
      // Register existing pool with the server so it knows about them
      this.ws.send(JSON.stringify({
        command: "setup_nonce_account",
        request_id: `nonce-${Date.now()}`,
        public_key: publicKey,
        existing_nonce_account: existingPool,
        turnkey_wallet: false,
        private_key: privateKey,
      }));
      onSuccess(existingPool[0], existingPool.length);
      return;
    }

    const requestId = `nonce-${Date.now()}`;

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.command !== "setup_nonce_account" || data.request_id !== requestId) return;

        this.ws?.removeEventListener("message", handler);
        clearTimeout(timeout);

        if (data.success && data.result) {
          // Save full pool if available, fallback to single nonce_account
          const pool: string[] = data.result.nonce_accounts || (data.result.nonce_account ? [data.result.nonce_account] : []);
          if (pool.length > 0) {
            saveNoncePool(publicKey, pool);
            console.log(`[222] Nonce pool created: ${pool.length} accounts`);
            onSuccess(pool[0], pool.length);
          } else {
            onError("No nonce accounts returned");
          }
        } else {
          onError(data.error || "Failed to create nonce account");
        }
      } catch {}
    };

    this.ws.addEventListener("message", handler);

    const timeout = setTimeout(() => {
      this.ws?.removeEventListener("message", handler);
      onError("Nonce setup timed out (30s)");
    }, 30_000);

    this.ws.send(JSON.stringify({
      command: "setup_nonce_account",
      request_id: requestId,
      public_key: publicKey,
      turnkey_wallet: false,
      sub_org_id: null,
      wallet_id: null,
      private_key_id: null,
      private_key: privateKey,
    }));

    console.log("[222] Setting up nonce pool for:", publicKey.slice(0, 8) + "...");
  }

  claimFees(
    publicKey: string,
    privateKey: string,
    onSuccess: (data: { claimed: number; signature?: string }) => void,
    onError: (error: string) => void
  ): void {
    if (!this.ws || !this.connected) {
      onError("Not connected to deploy server.");
      return;
    }

    const requestId = `close_atas_${Date.now()}`;

    const handler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.command !== "close_atas") return;
        if (data.request_id && data.request_id !== requestId) return;
        this.ws?.removeEventListener("message", handler);
        clearTimeout(timeout);
        if (data.success) {
          onSuccess({ claimed: data.totalReclaimed || 0, signature: data.signatures?.[0] });
        } else {
          onError(data.error || "Failed to close ATAs");
        }
      } catch {}
    };

    this.ws.addEventListener("message", handler);

    const timeout = setTimeout(() => {
      this.ws?.removeEventListener("message", handler);
      onError("Close ATAs timed out (60s)");
    }, 60_000);

    this.ws.send(JSON.stringify({
      command: "close_atas",
      wallets: [{ publicKey, privateKey }],
      request_id: requestId,
    }));
  }

  disconnect(): void {
    // Stop auto-reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    if (this.ws) {
      this.ws.onclose = null; // prevent scheduleReconnect firing
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.broadcastStatus(false);
  }

  getConnectionStatus(): boolean {
    return this.connected;
  }
}

// Singleton — auto-connects on first access (like 222 extension startup)
let deploymentService: TokenDeploymentService | null = null;

export function getDeploymentService(): TokenDeploymentService {
  if (!deploymentService) {
    deploymentService = new TokenDeploymentService();
    // Auto-connect immediately so WS is ready before user deploys
    deploymentService.connect().catch(() => {});
  }
  return deploymentService;
}
