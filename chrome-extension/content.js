// NNN Axiom Search - Double-click to search
// When you double-click a word on axiom.trade, it opens the search modal and types it in

(function () {
  "use strict";

  // React-compatible way to set input value
  function setReactInputValue(input, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Find and click the search button to open the modal
  function openSearchModal() {
    // The search button has ri-search-2-line icon
    const searchBtn = document.querySelector(
      'button i.ri-search-2-line'
    )?.closest("button");
    if (searchBtn) {
      searchBtn.click();
      return true;
    }
    return false;
  }

  // Find the search input inside the modal
  function findSearchInput() {
    return document.querySelector(
      'input[placeholder*="Search by name, ticker, or CA"]'
    );
  }

  // Type text into Axiom's search bar
  function searchAxiom(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 1) return;

    // Check if search modal is already open
    let input = findSearchInput();
    if (input) {
      // Modal already open - just type
      setReactInputValue(input, trimmed);
      input.focus();
      return;
    }

    // Open the modal first
    if (!openSearchModal()) return;

    // Wait for modal to appear, then type
    let attempts = 0;
    const interval = setInterval(() => {
      input = findSearchInput();
      if (input) {
        clearInterval(interval);
        setReactInputValue(input, trimmed);
        input.focus();
      }
      attempts++;
      if (attempts > 20) {
        clearInterval(interval); // give up after 1s
      }
    }, 50);
  }

  // Listen for double-click
  document.addEventListener("dblclick", () => {
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length >= 1 && selection.length < 100) {
      // Small delay to let browser finish selection
      setTimeout(() => searchAxiom(selection), 50);
    }
  });

  console.log("[NNN] Axiom search extension loaded");
})();
