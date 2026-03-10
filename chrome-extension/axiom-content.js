// Runs on axiom.trade
// 1) Receives search text from NNN tracker via background worker
// 2) Enhances search modal size (taller)
// 3) Injects Pump + USD1 deploy buttons onto each search result card

(function () {
  "use strict";

  // ─── React-compatible input setter ───────────────────────────────
  function setReactInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // ─── Search helpers ──────────────────────────────────────────────
  function openSearchModal() {
    const searchBtn = document.querySelector(
      "button i.ri-search-2-line"
    )?.closest("button");
    if (searchBtn) {
      searchBtn.click();
      return true;
    }
    return false;
  }

  function findSearchInput() {
    return document.querySelector(
      'input[placeholder*="Search by name, ticker, or CA"]'
    );
  }

  function searchAxiom(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    let input = findSearchInput();
    if (input) {
      setReactInputValue(input, trimmed);
      input.focus();
      return;
    }

    if (!openSearchModal()) {
      console.warn("[NNN] Could not find Axiom search button");
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      input = findSearchInput();
      if (input) {
        clearInterval(interval);
        setReactInputValue(input, trimmed);
        input.focus();
      }
      if (++attempts > 30) clearInterval(interval);
    }, 50);
  }

  // ─── Modal size enhancement ──────────────────────────────────────
  function enhanceModalSize() {
    const searchInput = document.querySelector(
      'input[placeholder*="Search by name, ticker, or CA"]'
    );
    if (!searchInput) return;

    const modal = searchInput.closest(".bg-backgroundTertiary");
    if (!modal) return;

    modal.style.cssText += `
      height: 85vh !important;
      max-height: 85vh !important;
      min-height: 700px !important;
    `;

    const resultsContainer =
      modal.querySelector('div[class*="overflow-y-auto"]') ||
      modal.querySelector(".flex.flex-col.flex-1") ||
      modal.querySelector('div[class*="h-[352px]"]');
    if (resultsContainer) {
      resultsContainer.style.cssText += `
        height: 60vh !important;
        max-height: 60vh !important;
        min-height: 500px !important;
        overflow-y: auto !important;
      `;
    }

    // Override Axiom's fixed-height containers
    const fixedContainers = modal.querySelectorAll('div[class*="h-["]');
    fixedContainers.forEach((c) => {
      const cls = c.classList.toString();
      if (
        cls.includes("h-[352px]") ||
        cls.includes("h-[600px]") ||
        cls.includes("h-[480px]")
      ) {
        c.style.cssText += `
          height: auto !important;
          min-height: 500px !important;
          max-height: 70vh !important;
        `;
      }
    });
  }

  // ─── Extract token details from a card DOM element ───────────────
  function extractTokenDetails(tokenSection) {
    try {
      let symbol = "";
      let fullName = "";

      // New Axiom structure: span.text-textPrimary with sm:text-[16px]
      const tickerSpan = tokenSection.querySelector(
        'span.text-textPrimary[class*="sm:text-[16px]"][class*="font-medium"]'
      );
      if (tickerSpan) {
        const innerDiv = tickerSpan.querySelector(
          "div.truncate, div[class*='whitespace-nowrap']"
        );
        if (innerDiv) symbol = innerDiv.textContent.trim();
        if (!symbol) symbol = tickerSpan.textContent.trim();
      }

      // Full name from the tertiary text span
      const nameSpan = tokenSection.querySelector(
        'span.text-textTertiary span[class*="font-medium"][class*="truncate"]'
      );
      if (nameSpan) {
        const innerDiv = nameSpan.querySelector(
          "div.truncate, div[class*='whitespace-nowrap']"
        );
        fullName = innerDiv
          ? innerDiv.textContent.trim()
          : nameSpan.textContent.trim();
      }

      // Fallback: old structure
      if (!symbol) {
        const tokenInfoDiv = tokenSection.querySelector(
          "div.flex.flex-col.gap-\\[4px\\]"
        );
        if (tokenInfoDiv) {
          const nameRow = tokenInfoDiv.querySelector(
            "div.flex.flex-row.gap-\\[4px\\]"
          );
          if (nameRow) {
            const ts = nameRow.querySelector("span.text-textPrimary");
            if (ts) {
              const d = ts.querySelector("div");
              if (d) symbol = d.textContent.trim();
            }
            if (!fullName) {
              const nb = nameRow.querySelector(
                'button span[class*="truncate"]'
              );
              if (nb) {
                const d = nb.querySelector("div");
                if (d) fullName = d.textContent.trim();
              }
            }
          }
        }
      }

      // Last-resort fallback for symbol
      if (!symbol) {
        const spans = tokenSection.querySelectorAll("span.text-textPrimary");
        for (const span of spans) {
          const t = span.textContent.trim();
          if (t.length >= 1 && t.length <= 15 && !t.includes(" ")) {
            symbol = t;
            break;
          }
        }
      }

      // Image URL
      let imgEl =
        tokenSection.querySelector('img[src*="axiomtrading"]') ||
        tokenSection.querySelector("img[src*='token'], img[src*='coin']") ||
        tokenSection.querySelector("img");
      const imageUrl = imgEl ? imgEl.src : "";

      if (!fullName && imgEl && imgEl.alt) fullName = imgEl.alt.trim();
      if (!fullName && symbol) fullName = symbol;

      return {
        symbol: symbol || "Unknown",
        fullName: fullName || symbol || "Unknown",
        imageUrl,
      };
    } catch {
      return null;
    }
  }

  // ─── Send message to background with error handling ───────────────
  function sendToBackground(message) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[NNN] sendMessage error:", chrome.runtime.lastError.message);
        } else {
          console.log("[NNN] Message sent OK:", message.type);
        }
      });
    } catch (err) {
      console.error("[NNN] sendMessage threw:", err);
    }
  }

  // ─── Inject Pump + USD1 deploy buttons onto each card ────────────
  let addButtonsTimer = null;

  function addDeployButtons(modal) {
    const hasSearchInput = modal.querySelector(
      'input[placeholder*="Search by name, ticker, or CA"]'
    );
    if (!hasSearchInput) return;

    // Find token cards (try multiple Axiom DOM structures)
    let tokenItems = modal.querySelectorAll(
      'a[href^="/meme/"][class*="flex-row"][class*="px-\\[16px\\]"]'
    );
    if (!tokenItems.length) {
      tokenItems = modal.querySelectorAll(
        'div.group.relative[class*="flex-row"][class*="px-\\[16px\\]"]'
      );
    }
    if (!tokenItems.length) {
      tokenItems = modal.querySelectorAll(
        'div.group.relative[class*="sm:h-\\[88px\\]"], div.group.relative[class*="h-\\[64px\\]"]'
      );
    }
    if (!tokenItems.length) return;

    const chains = [
      { name: "PUMP", icon: "icons/pump-logo.png", type: "pump" },
      { name: "USD1", icon: "icons/usd1-logo.png", type: "usd1" },
    ];

    tokenItems.forEach((tokenItem) => {
      if (tokenItem.querySelector(".nnn-deploy-container")) return;

      const details = extractTokenDetails(tokenItem);
      if (!details) return;

      tokenItem.style.position = "relative";

      // Container — sits to the left of Axiom's quick-buy button
      const container = document.createElement("div");
      container.className = "nnn-deploy-container";
      container.style.cssText = `
        position: absolute;
        right: 140px;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: row;
        gap: 4px;
        align-items: center;
        z-index: 10;
        pointer-events: auto;
      `;

      // Token image preview (click to send image to NNN tracker)
      if (details.imageUrl) {
        const imgBtn = document.createElement("button");
        imgBtn.title = "Send image to NNN Tracker";
        imgBtn.style.cssText = `
          width: 48px;
          height: 48px;
          padding: 0;
          border-radius: 6px;
          background: url('${details.imageUrl}');
          background-size: cover;
          background-position: center;
          border: 2px solid rgba(255, 255, 255, 0.25);
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        `;
        imgBtn.addEventListener("mouseenter", () => {
          imgBtn.style.transform = "scale(1.6)";
          imgBtn.style.borderColor = "rgba(255, 255, 255, 0.9)";
          imgBtn.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
          imgBtn.style.zIndex = "9999";
        });
        imgBtn.addEventListener("mouseleave", () => {
          imgBtn.style.transform = "scale(1)";
          imgBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
          imgBtn.style.boxShadow = "none";
          imgBtn.style.zIndex = "auto";
        });
        imgBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.log("[NNN] Image clicked, sending to tracker:", details.imageUrl);
          sendToBackground({
            type: "SEND_TO_TRACKER",
            data: {
              tokenName: details.fullName,
              tokenSymbol: details.symbol,
              tokenImage: details.imageUrl,
            },
          });
          imgBtn.style.borderColor = "rgb(16, 185, 129)";
          imgBtn.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.6)";
          setTimeout(() => {
            imgBtn.style.borderColor = "rgba(255, 255, 255, 0.25)";
            imgBtn.style.boxShadow = "none";
          }, 1200);
        });
        container.appendChild(imgBtn);
      }

      // Deploy buttons (Pump + USD1)
      chains.forEach((chain) => {
        const btn = document.createElement("button");
        btn.title = `Deploy ${details.fullName} on ${chain.name}`;
        btn.style.cssText = `
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: rgba(26, 26, 26, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          flex-shrink: 0;
        `;

        const icon = document.createElement("img");
        icon.src = chrome.runtime.getURL(chain.icon);
        icon.style.cssText = "width: 22px; height: 22px; object-fit: contain;";
        btn.appendChild(icon);

        btn.addEventListener("mouseenter", () => {
          btn.style.background = "rgba(255, 255, 255, 0.2)";
          btn.style.transform = "scale(1.1)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.4)";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "rgba(26, 26, 26, 0.9)";
          btn.style.transform = "scale(1)";
          btn.style.borderColor = "rgba(255, 255, 255, 0.2)";
        });

        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          console.log("[NNN] Deploy clicked:", chain.name, details.symbol);
          sendToBackground({
            type: "DEPLOY_TOKEN",
            data: {
              tokenName: details.fullName,
              tokenSymbol: details.symbol,
              tokenImage: details.imageUrl,
              platform: chain.type,
            },
          });

          // Visual feedback
          btn.style.background = "rgba(59, 130, 246, 0.9)";
          btn.innerHTML = '<span style="font-size:10px;color:#fff;">...</span>';
          setTimeout(() => {
            btn.style.background = "rgb(16, 185, 129)";
            btn.innerHTML =
              '<span style="font-size:14px;color:#fff;">&#10003;</span>';
            setTimeout(() => {
              btn.style.background = "rgba(26, 26, 26, 0.9)";
              btn.innerHTML = "";
              btn.appendChild(icon.cloneNode(true));
            }, 1500);
          }, 300);
        });

        container.appendChild(btn);
      });

      tokenItem.appendChild(container);
    });
  }

  // ─── Modal watcher ───────────────────────────────────────────────
  function startModalWatcher() {
    // Polling fallback (catches everything)
    setInterval(() => {
      const searchInput = document.querySelector(
        'input[placeholder*="Search by name, ticker, or CA"]'
      );
      if (!searchInput) return;

      const modal = searchInput.closest(".bg-backgroundTertiary");
      if (!modal) return;

      if (!modal.hasAttribute("data-nnn-enhanced")) {
        modal.setAttribute("data-nnn-enhanced", "true");
        enhanceModalSize();
        addDeployButtons(modal);
        setTimeout(() => addDeployButtons(modal), 100);
        setTimeout(() => addDeployButtons(modal), 300);
        setTimeout(() => addDeployButtons(modal), 500);
        setTimeout(() => addDeployButtons(modal), 1000);
      }

      // Always try to add buttons to new cards that loaded dynamically
      addDeployButtons(modal);
    }, 150);

    // MutationObserver for instant detection of modal + result changes
    let modalObserver = null;

    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (!node.querySelector) continue;

          const searchInput = node.querySelector(
            'input[placeholder*="Search by name, ticker, or CA"]'
          );
          if (!searchInput) continue;

          const modal = searchInput.closest(".bg-backgroundTertiary");
          if (!modal) continue;

          setTimeout(() => addDeployButtons(modal), 50);
          setTimeout(() => addDeployButtons(modal), 200);
          setTimeout(() => addDeployButtons(modal), 500);

          // Observe modal internals for dynamic result loading
          if (modalObserver) modalObserver.disconnect();

          modalObserver = new MutationObserver(() => {
            clearTimeout(addButtonsTimer);
            addButtonsTimer = setTimeout(() => {
              if (document.body.contains(modal)) {
                addDeployButtons(modal);
              } else {
                if (modalObserver) {
                  modalObserver.disconnect();
                  modalObserver = null;
                }
              }
            }, 200);
          });

          modalObserver.observe(modal, { childList: true, subtree: true });
        }
      }
    });

    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ─── Message listener (from background worker) ──────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "DO_SEARCH" && msg.text) {
      searchAxiom(msg.text);
    }
  });

  // ─── Init ────────────────────────────────────────────────────────
  startModalWatcher();
  console.log("[NNN] Axiom content script loaded (search + deploy buttons + modal enhance)");
})();
