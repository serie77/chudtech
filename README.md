# NNN Tracker

Real-time tweet tracker with one-click Solana token deployment via 222gazer WebSocket.

## Architecture

```
nextjs-site/              Main app (Next.js + TypeScript + Tailwind + Inter font)
  src/
    components/           UI panels (Panel1=Deploy, Panel2=Search+Images, Panel3=Feed)
    components/ui/        shadcn component library (Button, Dialog, Tabs, Input, etc.)
    services/             tokenApi.ts (222gazer WebSocket client)
    hooks/                useBarkFeed.ts, useJ7Feed.ts (tweet feed connections)
    utils/                themes.ts, imageGenerator.ts
    lib/                  axiom-store.ts (Axiom cookie persistence)
    app/api/              API routes (see below)
  set-cookie.js           CLI tool for setting Axiom cookie

chrome-extension/         Axiom bridge extension (Manifest V3)
  background.js           Service worker (tab routing)
  tracker-content.js      Runs on NNN Tracker (double-click search, token data receiver)
  axiom-content.js        Runs on Axiom (message bridge)
  axiom-inject.js         Injects chud.tech deploy buttons on Axiom
  popup.html/js           Extension settings popup
```

## How It Works

### Tweet Feed
Connects to BarkFeed or J7Feed via WebSocket. Tweets appear in Panel3 (right panel) in real-time. AI highlights tokenizable words using Groq API (`llama-3.1-8b-instant`).

### Token Deploy (222gazer)
All token deploys go through your own 222gazer WebSocket server. No third-party servers touch your private keys. The browser connects directly to the WebSocket from the client side.

**Connection:** `wss://eu.222gazer.xyz` with API key auth
- Auto-connects on page load (singleton in `tokenApi.ts`)
- Auto-reconnects every 5s on disconnect
- 30s ping heartbeat to keep connection alive
- Rust deploy enabled on connect

**Deploy payload sent to WebSocket:**
```json
{
  "command": "deploy",
  "platform": "pumpfun | launchlab | bonk | bags",
  "currency": "SOL | USD1",
  "name": "TokenName",
  "symbol": "TICKER",
  "image": "<data URL>",
  "buyAmount": 0.1,
  "wallet": { "publicKey": "...", "privateKey": "..." },
  "isBonkersEnabled": false,
  "isMayhemMode": false,
  "isCashbackEnabled": false,
  "autoSell": false,
  "bundleEnabled": false,
  "snipeWallets": []
}
```

**Platform mapping:**
| Frontend | WebSocket | Currency |
|----------|-----------|----------|
| pump     | pumpfun   | SOL      |
| bonk     | bonk      | SOL      |
| usd1     | launchlab | USD1     |
| bags     | bags      | SOL      |

### Wallet Storage
Private keys are XOR-obfuscated (salt: `222-local-mode-v1`) and stored in `localStorage` under `local_wallets`. Same pattern as the 222 extension. Keys are only sent over the encrypted WSS connection to your own server.

### Nonce Accounts
Managed via 222gazer WebSocket (`setup_nonce_account` command). Stored in `localStorage` under `nonce_accounts` keyed by wallet public key.

### Axiom Cookie
The Axiom token search requires an authenticated session cookie. The cookie is stored server-side in `.axiom-cookie` (gitignored) and persists across server restarts.

**Set via CLI:**
```bash
node set-cookie.js "<auth-refresh-token value>"
node set-cookie.js clear       # Remove cookie
node set-cookie.js             # Check status
```

The server auto-refreshes the access token using the refresh token — only the refresh token needs to be set. Managed by `lib/axiom-store.ts`.

## API Routes

| Route | Purpose |
|-------|---------|
| `/api/ai-suggest` | Groq API proxy for AI token name extraction |
| `/api/auth` | API key validation |
| `/api/link-metadata` | Fetches Open Graph metadata for link preview cards |
| `/api/og-image` | Fetches og:image / twitter:image from article URLs |
| `/api/presence` | SSE endpoint for live online user count |
| `/api/prices` | Proxies Hyperliquid API for SOL/BTC/ETH prices |
| `/api/proxy-image` | Image proxy to avoid CORS issues |
| `/api/token-search` | Axiom token search proxy (auto-refreshes access token) |

## Key Files

| File | Purpose |
|------|---------|
| `services/tokenApi.ts` | 222gazer WebSocket client, wallet storage, nonce helpers |
| `components/Panel1.tsx` | Token deploy form (name, symbol, image, platform, buy amount, block 0 bundles) |
| `components/Panel3.tsx` | Tweet feed with AI highlights, click-to-deploy, video poster thumbnails |
| `components/ResizablePanels.tsx` | Layout manager, AI processing, preset/keybind deploy |
| `components/Toast.tsx` | Header-mounted toast notifications (slide-down animation, 2s duration) |
| `components/AuthGate.tsx` | Login page with API key auth + auto-login |
| `components/SettingsModal.tsx` | App settings (themes, live prices toggle, etc.) |
| `components/DeploySettingsModal.tsx` | Deploy settings (wallets, presets, keybinds, block 0 wallet config) |
| `lib/axiom-store.ts` | Server-side Axiom cookie persistence (file-based) |
| `set-cookie.js` | CLI script to set/check/clear Axiom cookie |
| `hooks/useBarkFeed.ts` | BarkFeed WebSocket connection |
| `hooks/useJ7Feed.ts` | J7Feed Socket.IO connection |
| `utils/themes.ts` | Theme definitions (Modern Dark, Aqua, Dark, etc.) |

## Running Locally

```bash
cd nextjs-site
cp .env.example .env.local   # Add your CHUD_API_KEY
npm install
npm run dev
```

Open http://localhost:3000

## Features

### Deploy Panel
- **Quick buy buttons** — 5 configurable SOL preset amounts for one-click deploys
- **Bundle quick buy buttons** — Separate row for block 0 bundle deploys (same amount per wallet). Greyed out until at least one wallet is configured as a bundle wallet in Deploy Settings
- **Block 0 wallets** — Configure which wallets participate in bundle deploys via "Set as Bundle" in Deploy Settings. Yellow snipe icon indicates block 0-enabled wallets in both settings and the wallet dropdown
- **Quick deploy buttons** — LETTER, SOL, ASCII generate an image and deploy instantly
- **Bundle mode** — Standard bundle toggle for normal buy buttons (separate from block 0 bundle buttons)
- **Auto-Sell** — Automatically sell after deploy with configurable delay
- **Multi deploy** — Deploy multiple tokens in sequence
- **Cashback mode** — Toggle for Pump.fun deploys
- **Bonkers mode** — Toggle for Bonk/USD1 platforms
- **Google image search** — Search and select images inline
- **Clipboard paste** — Ctrl+V to paste images directly from clipboard into the deploy panel
- **Image management** — Hover X button to remove individual images from the selection grid
- **Test mode** — Preview deploy output without sending to WebSocket. Shows exact deploy settings: platform, wallets, amounts, all toggles. Deploy button matches the subtle dark style of the feed deploy button
- **Click-to-deploy mode** — Toggle between hold-and-release vs click-to-deploy for AI text. Drag-to-deploy works in both modes

### Deploy Settings
- **Wallet management** — Import wallets, set dev wallet (chef icon), drag-to-reorder, snipe icon for non-dev wallets
- **Block 0 bundle wallets** — "Set as Bundle" / "Unbundle" button per Solana wallet. Bundle-enabled wallets show yellow snipe crosshair and "Bundle" badge
- **Nonce accounts** — One-click nonce setup per wallet
- **Configurable keybinds** — Primary and secondary deploy shortcuts
- **Custom presets** — Named deploy templates with keybind triggers

### Tweet Feed
- **Inter font** — All text rendered in Inter (medium weight) for cleaner readability
- **AI highlights** — Auto-detected token names with one-click deploy
- **AI Picks** — Suggested token names/tickers with platform buttons inline next to name/ticker. Cashtags use the exact ticker as name (e.g. $SIMPLECLAW -> SIMPLECLAW, SIMPLECLAW)
- **Article image extraction** — OG images from article links are fetched automatically when tweets arrive
- **Video thumbnails** — Twitter's native poster thumbnails displayed instantly via `poster` attribute. Canvas-based first-frame extraction as fallback. No more duplicate video rendering
- **Follow event images** — Both follower and followed user profile pics available for deploy
- **Link preview cards** — Rich cards with title, description, and image for embedded links
- **Link preview images in deploy** — Double-click/copy auto-fill now includes OG images from link preview cards (not just media and profile pics)
- **Click-to-deploy** — DEPLOY button on every tweet sends images to the deploy panel
- **Tweet link fix** — Correctly strips non-numeric prefixes (e.g. `bark-`) from tweet status IDs for proper X.com links

### Header
- **Live crypto prices** — SOL, BTC, ETH from Hyperliquid API with green/red flash on price change (toggleable in settings)
- **Toast notifications** — Centered in header bar, slide-down animation with 2s auto-dismiss
- **Online counter** — Real-time count of logged-in users via SSE presence
- **Logout button** — Door icon next to the chud.tech logo

### Authentication
- **API key login** — Validated server-side against `CHUD_API_KEY` env variable
- **Auto-login** — Stored key is validated on page load, skips login if valid
- **Cookie-based session** — API key stored as HTTP cookie for server-side checks

### Themes
- Modern Dark (default), Aqua, Dark, and more
- Theme-aware inputs and panels throughout the app

## Chrome Extension

The extension bridges NNN Tracker and Axiom.

### Features
- **Chud.tech button on Axiom** — Appears on pulse cards, list cards, and /meme/ pages (same placement as 222 extension). Sends token info (name, symbol, image, twitter, platform) to the deploy panel.
- **Auto platform detection** — Detects pump/bonk/usd1/bags from Axiom card links and auto-selects the correct platform in deploy
- **Double-click search** — Double-click any word on NNN Tracker to search it on Axiom (toggleable in extension popup)

### Setup
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Click "Load unpacked" and select the `chrome-extension/` folder
4. Pin the extension for quick access to the settings popup

## localStorage Keys

| Key | Format | Purpose |
|-----|--------|---------|
| `nnn-block0-wallets` | JSON `{ [pubkey]: { enabled: boolean } }` | Block 0 bundle wallet selection |
| `nnn-bundle` | `"true"` / `"false"` | Bundle toggle state |
| `nnn-bundle-wallets` | JSON `{ [pubkey]: { enabled, amount } }` | Per-wallet bundle amounts |
| `nnn-buy-amount` | number string | Default SOL buy amount |
| `nnn-usd1-buy-amount` | number string | Default USD1 buy amount |
| `nnn-ai-click-mode` | `"hold"` / `"click"` | AI text deploy mode |
| `nnn-image-mode` | `"letter"` / `"sol"` / `"ascii"` | Default image generation mode |
| `nnn-autoticker` | `"true"` / `"false"` | Auto-generate ticker from name |
| `deployPresetAmounts` | JSON number array | SOL quick buy amounts |
| `deployPresetAmountsUSD1` | JSON number array | USD1 quick buy amounts |
| `deployBundlePresetAmounts` | JSON number array | SOL bundle quick buy amounts |
| `deployBundlePresetAmountsUSD1` | JSON number array | USD1 bundle quick buy amounts |

## Hosting

The Next.js site can be hosted anywhere (Vercel, Cloudflare Pages, a VPS, etc.). The site itself is just a frontend that serves static HTML/JS/CSS. All deploy traffic goes directly from the user's browser to the 222gazer WebSocket server (`wss://eu.222gazer.xyz`) — the hosting location of the site does not affect deploy latency. Deploy speed depends on the user's ping to the WebSocket server (Virginia).
