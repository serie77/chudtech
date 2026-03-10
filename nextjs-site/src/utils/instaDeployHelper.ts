import { storeGet } from "@/lib/store";

// Helper functions for Insta-Deploy functionality

export interface InstaDeploySettings {
  primaryKeybind: string;
  secondaryKeybind: string;
  doubleClickEnabled: boolean;
}

export function loadInstaDeploySettings(): InstaDeploySettings {
  if (typeof window === 'undefined') {
    return {
      primaryKeybind: 'Ctrl + X',
      secondaryKeybind: '',
      doubleClickEnabled: false
    };
  }

  return {
    primaryKeybind: storeGet('insta-deploy-primary') || 'Ctrl + X',
    secondaryKeybind: storeGet('insta-deploy-secondary') || '',
    doubleClickEnabled: storeGet('insta-deploy-double-click') === 'true'
  };
}

export function matchesKeybind(event: KeyboardEvent, keybind: string): boolean {
  if (!keybind || keybind === 'None') return false;
  
  // Parse keybind string (e.g., "Ctrl + X" or "Ctrl + Alt + E")
  const parts = keybind.split(' + ').map(p => p.trim());
  
  // Check modifiers
  const hasCtrl = parts.includes('Ctrl');
  const hasAlt = parts.includes('Alt');
  const hasShift = parts.includes('Shift');
  const hasMeta = parts.includes('Meta');
  
  // Get the main key (last part)
  const mainKey = parts[parts.length - 1].toUpperCase();
  
  // Check if event matches
  return (
    event.ctrlKey === hasCtrl &&
    event.altKey === hasAlt &&
    event.shiftKey === hasShift &&
    event.metaKey === hasMeta &&
    event.key.toUpperCase() === mainKey
  );
}

export function getSelectedText(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  
  const selectedText = selection.toString().trim();
  return selectedText || null;
}

export function generateTokenData(selectedText: string) {
  const cleanText = selectedText.trim();
  
  // Generate name and ticker based on text
  let name: string;
  let ticker: string;
  
  const words = cleanText.split(/\s+/);
  
  if (words.length === 1) {
    // Single word: use as-is for name, uppercase for ticker
    name = cleanText;
    ticker = cleanText.toUpperCase();
  } else {
    // Multiple words: use full text for name, abbreviate for ticker
    name = cleanText;
    
    // Smart abbreviation logic
    if (cleanText.length <= 13) {
      ticker = cleanText.toUpperCase();
    } else if (words.length > 1) {
      // Take first letter of each word
      ticker = words.map(w => w[0]).join('').toUpperCase().slice(0, 13);
    } else {
      // Single long word - take first 13 chars
      ticker = cleanText.slice(0, 13).toUpperCase();
    }
  }
  
  return { name, ticker };
}

export function findNearestTweetData(element: Element | null): { imageUrl: string | null, tweetLink: string | null } {
  let imageUrl: string | null = null;
  let tweetLink: string | null = null;
  
  // Walk up the DOM to find the tweet container
  let current = element;
  while (current && current !== document.body) {
    // Look for tweet image within this container
    if (!imageUrl) {
      const img = current.querySelector('img');
      if (img && img.src && !img.src.includes('profile_images')) {
        imageUrl = img.src;
      }
    }
    
    // Look for tweet link data
    if (!tweetLink) {
      const tweetElement = current.closest('[data-tweet-url]');
      if (tweetElement) {
        tweetLink = tweetElement.getAttribute('data-tweet-url');
      }
    }
    
    if (imageUrl && tweetLink) break;
    
    current = current.parentElement;
  }
  
  return { imageUrl, tweetLink };
}
