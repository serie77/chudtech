// Per-user localStorage wrapper — keys are namespaced by API key hash
// so different logins get isolated settings, wallets, and presets.
// Settings are also synced to the server so they persist across devices.

// Keys that live outside user scope (needed before/during login)
const GLOBAL_KEYS = new Set(["chud-api-key", "chud-region"]);

// Keys to exclude from server sync (too large or not useful cross-device)
const SYNC_EXCLUDE = new Set(["__migrated"]);

/** Short stable hash of the API key, used as localStorage prefix */
function getUserPrefix(): string {
  if (typeof window === "undefined") return "";
  const apiKey = localStorage.getItem("chud-api-key");
  if (!apiKey) return "";
  let hash = 0;
  for (let i = 0; i < apiKey.length; i++) {
    hash = ((hash << 5) - hash + apiKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36) + "_";
}

export function storeGet(key: string): string | null {
  if (GLOBAL_KEYS.has(key)) return localStorage.getItem(key);
  const prefix = getUserPrefix();
  return localStorage.getItem(prefix + key);
}

export function storeSet(key: string, value: string): void {
  if (GLOBAL_KEYS.has(key)) {
    localStorage.setItem(key, value);
    return;
  }
  const prefix = getUserPrefix();
  localStorage.setItem(prefix + key, value);
  scheduleSyncToServer();
}

export function storeRemove(key: string): void {
  if (GLOBAL_KEYS.has(key)) {
    localStorage.removeItem(key);
    return;
  }
  const prefix = getUserPrefix();
  localStorage.removeItem(prefix + key);
  scheduleSyncToServer();
}

// ── Server sync ──

let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounced save — waits 2s after last change before syncing */
function scheduleSyncToServer(): void {
  if (typeof window === "undefined") return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    syncToServer();
  }, 2000);
}

/** Collect all user-prefixed keys and POST to server */
function syncToServer(): void {
  const prefix = getUserPrefix();
  if (!prefix) return;

  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(prefix)) continue;
    const shortKey = k.slice(prefix.length);
    if (SYNC_EXCLUDE.has(shortKey)) continue;
    settings[shortKey] = localStorage.getItem(k) || "";
  }

  fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  }).catch(() => {
    // Silent fail — next change will retry
  });
}

/** Load settings from server and write to localStorage */
export async function loadFromServer(): Promise<void> {
  const prefix = getUserPrefix();
  if (!prefix) return;

  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const settings: Record<string, string> = await res.json();
    if (!settings || typeof settings !== "object") return;

    // Only write keys that don't already exist locally (local takes priority on first load)
    // On a fresh browser/device, nothing exists so everything loads from server
    const keys = Object.keys(settings);
    if (keys.length === 0) return;

    for (const [shortKey, value] of Object.entries(settings)) {
      if (SYNC_EXCLUDE.has(shortKey)) continue;
      const fullKey = prefix + shortKey;
      const local = localStorage.getItem(fullKey);

      // Wallets: merge server + local by publicKey so all devices see all wallets
      if (shortKey.startsWith("local_wallets") && local) {
        try {
          const localArr: { publicKey: string }[] = JSON.parse(local);
          const serverArr: { publicKey: string }[] = JSON.parse(value);
          const seen = new Set(localArr.map(w => w.publicKey));
          const merged = [...localArr, ...serverArr.filter(w => !seen.has(w.publicKey))];
          if (merged.length > localArr.length) {
            localStorage.setItem(fullKey, JSON.stringify(merged));
            scheduleSyncToServer(); // push merged list back to server
          }
        } catch {
          // Bad JSON, skip merge
        }
        continue;
      }

      if (local === null) {
        localStorage.setItem(fullKey, value);
      }
    }
  } catch {
    // Server unreachable — continue with local storage only
  }
}

// ── Migration ──

/** One-time migration: copy existing un-prefixed keys into the user namespace */
export function migrateToUserStorage(): void {
  const prefix = getUserPrefix();
  if (!prefix) return;
  if (localStorage.getItem(prefix + "__migrated")) return;

  const appPrefixes = [
    "nnn-",
    "local_wallets",
    "nonce_accounts",
    "deploy",
    "insta-deploy",
    "ai-",
    "ai_",
    "groq-",
    "panel2-",
    "image-library",
    "customPresets",
  ];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || GLOBAL_KEYS.has(k) || k.startsWith(prefix)) continue;
    if (appPrefixes.some((p) => k.startsWith(p))) {
      const val = localStorage.getItem(k);
      if (val !== null) localStorage.setItem(prefix + k, val);
    }
  }

  localStorage.setItem(prefix + "__migrated", "1");
}
