const toggle = document.getElementById('dblclick-toggle');

// Load saved state (default: enabled)
chrome.storage.local.get({ dblclickSearch: true }, (result) => {
  toggle.checked = result.dblclickSearch;
});

// Save on change
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ dblclickSearch: toggle.checked });
});
