// Background service worker
// Relays messages between NNN Tracker tab ↔ Axiom tab

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[NNN BG] Received:", msg.type, msg);

  // ─── NNN Tracker → Axiom: double-click search ───────────────────
  if (msg.type === "SEARCH_AXIOM" && msg.text) {
    const searchText = msg.text;

    chrome.tabs.query({ url: ["https://axiom.trade/*", "https://*.axiom.trade/*"] }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const axiomTab = tabs[0];
        chrome.windows.update(axiomTab.windowId, { focused: true });
        chrome.tabs.update(axiomTab.id, { active: true }, () => {
          chrome.tabs.sendMessage(axiomTab.id, { type: "DO_SEARCH", text: searchText });
        });
      } else {
        chrome.tabs.create({ url: "https://axiom.trade/" }, (newTab) => {
          const listener = (tabId, changeInfo) => {
            if (tabId === newTab.id && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                chrome.tabs.sendMessage(newTab.id, { type: "DO_SEARCH", text: searchText });
              }, 1000);
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
    });
    return true; // keep channel open for async
  }

  // ─── Axiom → NNN Tracker: deploy token or send image ────────────
  if (msg.type === "DEPLOY_TOKEN" || msg.type === "SEND_TO_TRACKER") {
    // Query ALL tabs and find localhost manually (more reliable)
    chrome.tabs.query({}, (allTabs) => {
      const trackerTabs = allTabs.filter(t =>
        t.url && (t.url.startsWith("http://localhost") || t.url.startsWith("http://127.0.0.1") || t.url.includes("chud.tech"))
      );
      console.log("[NNN BG] Found tracker tabs:", trackerTabs.length, trackerTabs.map(t => t.url));

      if (trackerTabs.length > 0) {
        // Send to ALL matching tracker tabs
        trackerTabs.forEach(tab => {
          console.log("[NNN BG] Sending to tab:", tab.id, tab.url);
          chrome.tabs.sendMessage(tab.id, {
            type: msg.type,
            data: msg.data,
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn("[NNN BG] sendMessage to tab failed:", tab.id, chrome.runtime.lastError.message);
            } else {
              console.log("[NNN BG] Message delivered to tab:", tab.id);
            }
          });
        });
      } else {
        console.warn("[NNN BG] No tracker tabs found!");
      }
    });
    return true; // keep channel open for async
  }
});

console.log("[NNN] Background service worker loaded");
