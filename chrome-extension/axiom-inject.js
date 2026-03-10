// Runs on axiom.trade
// Injects chud.tech button on pulse cards and /meme/ token pages
// Clicking sends token info to NNN Tracker's deploy panel

(function () {
  "use strict";

  const CHUD_ICON_URL = chrome.runtime.getURL("icons/chud.jpg");
  const processedPulse = new WeakSet();
  const processedMeme = new WeakSet();

  // ─── Send message to background → NNN tracker ───────────────────
  function sendToTracker(data) {
    try {
      chrome.runtime.sendMessage({
        type: "DEPLOY_TOKEN",
        data: data,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[CHUD] sendMessage error:", chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.error("[CHUD] sendMessage threw:", err);
    }
  }

  // ─── Create the chud button element ─────────────────────────────
  function createSwordButton(size, tokenDetails, onSuccess) {
    const btn = document.createElement("button");
    btn.className = "chud-sword-btn";
    btn.title = `Deploy ${tokenDetails.symbol} on chud.tech`;
    btn.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      border-radius: 5px;
      background: rgba(20, 20, 28, 0.85);
      border: 1px solid rgba(231, 76, 60, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
      padding: 0;
      position: relative;
      z-index: 10;
    `;

    const icon = document.createElement("img");
    icon.src = CHUD_ICON_URL;
    icon.style.cssText = `
      width: ${Math.round(size * 0.7)}px;
      height: ${Math.round(size * 0.7)}px;
      pointer-events: none;
      border-radius: 3px;
      object-fit: cover;
      filter: brightness(1);
      transition: filter 0.2s;
    `;
    btn.appendChild(icon);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(231, 76, 60, 0.15)";
      btn.style.borderColor = "rgba(231, 76, 60, 0.7)";
      btn.style.transform = "scale(1.1)";
      btn.style.boxShadow = "0 0 12px rgba(231, 76, 60, 0.3)";
      icon.style.filter = "brightness(1.4)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(20, 20, 28, 0.85)";
      btn.style.borderColor = "rgba(231, 76, 60, 0.3)";
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "none";
      icon.style.filter = "brightness(1)";
    });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      sendToTracker(tokenDetails);

      // Visual feedback: chud → check
      btn.style.background = "rgba(231, 76, 60, 0.3)";
      btn.style.borderColor = "rgba(231, 76, 60, 0.8)";
      btn.style.boxShadow = "0 0 16px rgba(231, 76, 60, 0.5)";
      icon.style.display = "none";
      const check = document.createElement("span");
      check.textContent = "✓";
      check.style.cssText = "color: #e74c3c; font-size: " + Math.round(size * 0.5) + "px; font-weight: bold;";
      btn.appendChild(check);

      setTimeout(() => {
        btn.style.background = "rgba(20, 20, 28, 0.85)";
        btn.style.borderColor = "rgba(231, 76, 60, 0.3)";
        btn.style.boxShadow = "none";
        icon.style.display = "block";
        check.remove();
      }, 1200);

      if (onSuccess) onSuccess();
    });

    return btn;
  }

  // ─── Detect platform from a card's links/badges ─────────────────
  function detectPlatform(el) {
    // Check links inside the card
    const pumpLink = el.querySelector('a[href*="pump.fun"]');
    const bonkLink = el.querySelector('a[href*="bonk.fun"]');
    const bagsLink = el.querySelector('a[href*="bags.fm"]');

    if (bagsLink) return "bags";
    if (bonkLink) {
      // Check if USD1 variant
      const text = el.textContent.toLowerCase();
      if (text.includes("usd1")) return "usd1";
      return "bonk";
    }
    if (pumpLink) return "pump";

    // Check badge images/text
    const badges = el.querySelectorAll('img[alt], span[class*="badge"], div[class*="badge"]');
    for (const badge of badges) {
      const alt = (badge.alt || "").toLowerCase();
      const text = (badge.textContent || "").toLowerCase();
      if (alt.includes("bags") || text.includes("bags") || text.includes("meteora")) return "bags";
      if (alt.includes("usd1") || text.includes("usd1")) return "usd1";
      if (alt.includes("bonk") || text.includes("bonk") || alt.includes("raydium") || text.includes("raydium")) return "bonk";
      if (alt.includes("pump") || text.includes("pump")) return "pump";
    }

    return "pump"; // default
  }

  // ─── Detect platform from /meme/ page ──────────────────────────
  function detectMemePagePlatform() {
    try {
      const badges = document.querySelectorAll('div[class*="badge"], span[class*="badge"], a[href*="pump.fun"], a[href*="bonk.fun"], a[href*="bags.fm"]');
      for (const badge of badges) {
        const text = (badge.textContent || "").toLowerCase();
        const href = (badge.href || "").toLowerCase();
        if (href.includes("bags.fm") || text.includes("bags") || text.includes("meteora")) return "bags";
        if (text.includes("usd1") || href.includes("usd1")) return "usd1";
        if (text.includes("bonk") || href.includes("bonk.fun")) return "bonk";
        if (text.includes("pump") || href.includes("pump.fun")) return "pump";
      }

      // Check page text for platform indicators
      const pageText = document.body.textContent.toLowerCase();
      if (pageText.includes("bags.fm") || pageText.includes("meteora dbc")) return "bags";
      if (pageText.includes("usd1")) return "usd1";
      if (pageText.includes("bonk.fun")) return "bonk";

      return "pump";
    } catch {
      return "pump";
    }
  }

  // ─── Extract token details from pulse card ──────────────────────
  function extractPulseDetails(card) {
    try {
      const tickerDiv = card.querySelector('div.text-textPrimary[class*="truncate"]');
      const nameDiv = card.querySelector('div.text-inherit[class*="truncate"]');
      const img = card.querySelector('img[src*="axiomtrading"]') ||
                  card.querySelector('img[alt]:not([alt="Pump V1"]):not([alt="Pump V2"]):not([width="10"])');

      // Get mint from link
      const link = card.querySelector('a[href*="/meme/"]');
      const mint = link ? link.getAttribute("href").replace("/meme/", "").split("?")[0] : "";

      const symbol = tickerDiv ? tickerDiv.textContent.trim() : "";
      const fullName = nameDiv ? nameDiv.textContent.trim() : symbol;
      const imageUrl = img ? img.src : "";

      if (!symbol) return null;

      // Try to extract twitter link
      const twitterLink = card.querySelector('a[href*="twitter.com"], a[href*="x.com"]');
      const twitter = twitterLink ? twitterLink.href : "";

      return {
        tokenName: fullName || symbol,
        tokenSymbol: symbol,
        tokenImage: imageUrl,
        tokenMint: mint,
        twitter: twitter,
        platform: detectPlatform(card),
      };
    } catch {
      return null;
    }
  }

  // ─── Extract token details from /meme/ page ────────────────────
  function extractMemePageDetails() {
    try {
      // Get mint from URL
      const pathParts = window.location.pathname.split("/");
      const memeIdx = pathParts.indexOf("meme");
      const mint = memeIdx >= 0 && pathParts[memeIdx + 1] ? pathParts[memeIdx + 1] : "";

      // Token symbol - look in the main token header area
      let symbol = "";
      let fullName = "";

      // Try the main token info section
      const tickerSpans = document.querySelectorAll('span.text-textPrimary[class*="font-medium"]');
      for (const span of tickerSpans) {
        const text = span.textContent.trim();
        if (text.length >= 1 && text.length <= 15 && !text.includes(" ") && !text.includes("$")) {
          symbol = text;
          break;
        }
      }

      // Full name
      const nameSpan = document.querySelector('span.text-textTertiary span[class*="font-medium"]');
      if (nameSpan) {
        const inner = nameSpan.querySelector("div.truncate, div[class*='whitespace-nowrap']");
        fullName = inner ? inner.textContent.trim() : nameSpan.textContent.trim();
      }

      // Fallback: try the h1 or prominent spans
      if (!symbol) {
        const h1 = document.querySelector("h1");
        if (h1) symbol = h1.textContent.trim();
      }

      // Image — scope to the token header section first (like 222 extension)
      let imageUrl = "";
      const tokenSection = document.querySelector("div.flex.flex-row.gap-\\[8px\\].justify-center.items-center") ||
                           document.querySelector("div.flex.flex-row.gap-\\[8px\\]");
      if (tokenSection) {
        const sectionImg = tokenSection.querySelector('img[src*="axiomtrading"]') ||
                           tokenSection.querySelector('img[src*="token"], img[src*="coin"]') ||
                           tokenSection.querySelector("img");
        if (sectionImg) imageUrl = sectionImg.src;
      }
      // Fallback: broader search but prefer axiomtrading CDN images
      if (!imageUrl) {
        const fallbackImg = document.querySelector('img[src*="axiomtrading"]');
        if (fallbackImg) imageUrl = fallbackImg.src;
      }

      // Twitter
      const twitterLink = document.querySelector('a[href*="twitter.com"]:not([href*="search"]), a[href*="x.com"]:not([href*="search"])');
      const twitter = twitterLink ? twitterLink.href : "";

      if (!symbol && !mint) return null;

      return {
        tokenName: fullName || symbol,
        tokenSymbol: symbol,
        tokenImage: imageUrl,
        tokenMint: mint,
        twitter: twitter,
        platform: detectMemePagePlatform(),
      };
    } catch {
      return null;
    }
  }

  // ─── Inject chud buttons on pulse page cards ───────────────────
  function processPulseCards() {
    // Try multiple selectors for pulse cards
    const cards = document.querySelectorAll('[class*="pulseRow"]');

    cards.forEach((card) => {
      if (processedPulse.has(card)) return;
      if (card.querySelector(".chud-sword-btn")) return;

      const details = extractPulseDetails(card);
      if (!details) return;

      processedPulse.add(card);

      // Find the ticker div's flex row to insert after
      const tickerDiv = card.querySelector('div.text-textPrimary[class*="truncate"]');
      if (!tickerDiv) return;

      const flexRow = tickerDiv.closest('div.flex, div[class*="flex-row"]');
      if (flexRow) {
        flexRow.style.overflow = "visible";
        if (flexRow.parentNode) flexRow.parentNode.style.overflow = "visible";
        if (flexRow.parentNode?.parentNode) flexRow.parentNode.parentNode.style.overflow = "visible";
      }

      const btn = createSwordButton(20, details);
      btn.style.marginLeft = "4px";

      if (flexRow && tickerDiv.nextSibling) {
        flexRow.insertBefore(btn, tickerDiv.nextSibling);
      } else if (flexRow) {
        flexRow.appendChild(btn);
      }
    });
  }

  // ─── Inject chud buttons on list-style token cards ─────────────
  function processListCards() {
    const selectors = [
      'a.flex.flex-row.flex-1[class*="h-[88px]"]',
      'a.flex.flex-row.flex-1[class*="h-[64px]"]',
      'a[href^="/meme/"][class*="flex-row"][class*="px-[16px]"]',
      'div.group.relative[class*="flex-row"][class*="px-[16px]"]',
      'div.group.relative[class*="sm:h-[88px]"]',
      'div.group.relative[class*="h-[64px]"]',
    ];

    const allCards = new Set();
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => allCards.add(el));
    });

    allCards.forEach((card) => {
      if (processedPulse.has(card)) return;
      if (card.querySelector(".chud-sword-btn")) return;

      processedPulse.add(card);

      // Extract details
      let symbol = "";
      let fullName = "";
      let imageUrl = "";
      let mint = "";

      const href = card.getAttribute("href") || card.querySelector("a[href*='/meme/']")?.getAttribute("href") || "";
      if (href.includes("/meme/")) {
        mint = href.split("/meme/")[1]?.split("?")[0] || "";
      }

      const tickerSpan = card.querySelector('span.text-textPrimary[class*="font-medium"]');
      if (tickerSpan) {
        const inner = tickerSpan.querySelector("div.truncate, div[class*='whitespace-nowrap']");
        symbol = inner ? inner.textContent.trim() : tickerSpan.textContent.trim();
      }

      const nameSpan = card.querySelector('span.text-textTertiary span[class*="font-medium"]');
      if (nameSpan) {
        const inner = nameSpan.querySelector("div.truncate, div[class*='whitespace-nowrap']");
        fullName = inner ? inner.textContent.trim() : nameSpan.textContent.trim();
      }

      const img = card.querySelector('img[src*="axiomtrading"]') || card.querySelector("img");
      if (img) imageUrl = img.src;

      if (!symbol) return;

      const details = {
        tokenName: fullName || symbol,
        tokenSymbol: symbol,
        tokenImage: imageUrl,
        tokenMint: mint,
        twitter: "",
        platform: detectPlatform(card),
      };

      // Insert button - find the right spot near the token name
      card.style.position = "relative";
      const container = document.createElement("div");
      container.style.cssText = `
        position: absolute;
        right: 140px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        pointer-events: auto;
      `;
      container.appendChild(createSwordButton(28, details));
      card.appendChild(container);
    });
  }

  // ─── Inject chud button on /meme/ token page ───────────────────
  function processMemePageButton() {
    if (!window.location.pathname.includes("/meme/")) return;

    // Look for the token header section
    const sections = document.querySelectorAll("div.flex.flex-row.gap-\\[8px\\].justify-center.items-center");

    for (const section of sections) {
      if (processedMeme.has(section)) continue;
      if (section.querySelector(".chud-sword-btn")) continue;

      processedMeme.add(section);

      const details = extractMemePageDetails();
      if (!details) continue;

      const btn = createSwordButton(32, details);
      btn.style.marginLeft = "6px";
      section.appendChild(btn);
      return; // Only add one
    }

    // Fallback: try the quick-buy area
    const quickBuy = document.querySelector('.hidden.sm\\:flex[class*="gap"]');
    if (quickBuy && !quickBuy.querySelector(".chud-sword-btn")) {
      if (processedMeme.has(quickBuy)) return;
      processedMeme.add(quickBuy);

      const details = extractMemePageDetails();
      if (!details) return;

      const btn = createSwordButton(32, details);
      btn.style.marginRight = "6px";
      quickBuy.insertBefore(btn, quickBuy.firstChild);
    }
  }

  // ─── Main processing loop ──────────────────────────────────────
  function processAll() {
    processPulseCards();
    processListCards();
    processMemePageButton();
  }

  // ─── Init: observer + polling + scroll ──────────────────────────
  let debounceTimer = null;
  function debouncedProcess() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processAll, 150);
  }

  // MutationObserver for dynamic content
  const observer = new MutationObserver(debouncedProcess);
  observer.observe(document.body, { childList: true, subtree: true });

  // Scroll listener
  window.addEventListener("scroll", debouncedProcess, { passive: true });
  document.addEventListener("scroll", debouncedProcess, { passive: true, capture: true });

  // Polling fallback
  setInterval(processAll, 3000);

  // Initial injection with retries
  setTimeout(processAll, 500);
  setTimeout(processAll, 1500);
  setTimeout(processAll, 3000);

  // URL change detection (Axiom uses client-side routing)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      // Reset for new page
      setTimeout(processAll, 500);
      setTimeout(processAll, 1500);
    }
  });
  urlObserver.observe(document.querySelector("head > title") || document.head, { childList: true, subtree: true });
  // Also check with interval since title observer may miss SPA changes
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(processAll, 500);
      setTimeout(processAll, 1500);
    }
  }, 1000);

  console.log("[CHUD] Axiom chud injection loaded (pulse + meme + list cards)");
})();
