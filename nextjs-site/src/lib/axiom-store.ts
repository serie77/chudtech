// Universal Axiom cookie store — persisted to disk so it survives server restarts
// Set via /api/axiom-cookie POST, CLI script, or read by /api/token-search

import fs from 'fs';
import path from 'path';

const COOKIE_FILE = path.join(process.cwd(), '.axiom-cookie');

let cached: string | null | undefined = undefined; // undefined = not loaded yet

function loadFromDisk(): string | null {
  try {
    const val = fs.readFileSync(COOKIE_FILE, 'utf-8').trim();
    return val || null;
  } catch {
    return null;
  }
}

export function getAxiomCookie(): string | null {
  // Check in-memory cache first (set via /admin or API)
  if (cached === undefined) {
    cached = loadFromDisk();
  }
  if (cached) return cached;
  // Fallback to env variable (survives redeploys on Railway)
  return process.env.AXIOM_REFRESH_TOKEN || null;
}

export function setAxiomCookie(cookie: string | null): void {
  cached = cookie;
  try {
    if (cookie) {
      fs.writeFileSync(COOKIE_FILE, cookie, 'utf-8');
    } else {
      fs.unlinkSync(COOKIE_FILE);
    }
  } catch {}
}
