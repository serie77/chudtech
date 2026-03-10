// Runs on NNN Tracker (localhost / chud.tech)
// 1) Sends double-clicked word to background → Axiom tab (if enabled)
// 2) Receives token data from Axiom → dispatches to the Next.js app

(function () {
  "use strict";

  // ─── Double-click → Axiom search (gated by setting) ───────────
  document.addEventListener("dblclick", () => {
    const selection = window.getSelection().toString().trim();
    if (!selection || selection.length < 1 || selection.length >= 100) return;

    chrome.storage.local.get({ dblclickSearch: true }, (result) => {
      if (result.dblclickSearch) {
        chrome.runtime.sendMessage({ type: "SEARCH_AXIOM", text: selection });
      }
    });
  });

  // ─── Receive token data from Axiom (via background) ─────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("[NNN Tracker] Received message:", msg.type, msg);
    if (msg.type === "DEPLOY_TOKEN" || msg.type === "SEND_TO_TRACKER") {
      // Dispatch a custom event the Next.js app can listen to
      window.dispatchEvent(
        new CustomEvent("nnn-extension-data", {
          detail: {
            type: msg.type,
            data: msg.data,
          },
        })
      );
      console.log("[NNN Tracker] Dispatched nnn-extension-data event");
      sendResponse({ ok: true });
    }
    return true;
  });

  console.log("[NNN] Tracker ↔ Axiom bridge loaded");
})();
