import { NextRequest, NextResponse } from 'next/server';
import { getAxiomCookie } from '@/lib/axiom-store';

// In-memory cache for the access token (survives across requests, resets on server restart)
let cachedAccessToken: string | null = null;
let accessTokenExpiry: number = 0;

// Single refresh attempt
async function tryRefresh(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://api3.axiom.trade/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'Origin': 'https://axiom.trade',
      'Referer': 'https://axiom.trade/',
      'Cookie': `auth-refresh-token=${refreshToken}`,
    },
    body: '{}',
  });

  // Try getSetCookie first, then fall back to raw header parsing
  let setCookies: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') {
    setCookies = res.headers.getSetCookie();
  }
  if (setCookies.length === 0) {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookies = raw.split(/,(?=\s*\w+=)/);
  }

  for (const sc of setCookies) {
    const match = sc.match(/auth-access-token=([^;]+)/);
    if (match) return match[1];
  }

  // Also check JSON response body
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.accessToken) return data.accessToken;
    if (data.token) return data.token;
    if (data['auth-access-token']) return data['auth-access-token'];
  } catch {
    // Not JSON
  }

  return null;
}

// Retry refresh up to 3 times
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const token = await tryRefresh(refreshToken);
      if (token) return token;
    } catch {
      // retry
    }
    if (i < 2) await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

// Build cookie string, auto-refreshing the access token if needed
async function buildCookieString(rawCookie: string): Promise<string> {
  const refreshMatch = rawCookie.match(/auth-refresh-token=([^;]+)/);
  const accessMatch = rawCookie.match(/auth-access-token=([^;]+)/);

  if (refreshMatch) {
    const refreshToken = refreshMatch[1];

    // Check if we have a cached valid access token
    if (cachedAccessToken && Date.now() < accessTokenExpiry) {
      return `auth-refresh-token=${refreshToken}; auth-access-token=${cachedAccessToken}`;
    }

    // Check if the user-provided access token is still valid
    if (accessMatch) {
      try {
        const payload = JSON.parse(atob(accessMatch[1].split('.')[1]));
        if (payload.exp && payload.exp * 1000 > Date.now() + 30000) {
          cachedAccessToken = accessMatch[1];
          accessTokenExpiry = payload.exp * 1000 - 30000;
          return rawCookie;
        }
      } catch {
        // Can't decode, try refresh
      }
    }

    // Try to get a fresh access token
    const newAccessToken = await refreshAccessToken(refreshToken);
    if (newAccessToken) {
      cachedAccessToken = newAccessToken;
      try {
        const payload = JSON.parse(atob(newAccessToken.split('.')[1]));
        accessTokenExpiry = payload.exp ? payload.exp * 1000 - 30000 : Date.now() + 14 * 60 * 1000;
      } catch {
        accessTokenExpiry = Date.now() + 14 * 60 * 1000;
      }
      return `auth-refresh-token=${refreshToken}; auth-access-token=${newAccessToken}`;
    }

    // Refresh failed - try with just the refresh token
    return `auth-refresh-token=${refreshToken}`;
  }

  // Bare JWT token (no prefix)
  if (rawCookie.startsWith('eyJ')) {
    if (cachedAccessToken && Date.now() < accessTokenExpiry) {
      return `auth-refresh-token=${rawCookie}; auth-access-token=${cachedAccessToken}`;
    }
    const newAccessToken = await refreshAccessToken(rawCookie);
    if (newAccessToken) {
      cachedAccessToken = newAccessToken;
      try {
        const payload = JSON.parse(atob(newAccessToken.split('.')[1]));
        accessTokenExpiry = payload.exp ? payload.exp * 1000 - 30000 : Date.now() + 14 * 60 * 1000;
      } catch {
        accessTokenExpiry = Date.now() + 14 * 60 * 1000;
      }
      return `auth-refresh-token=${rawCookie}; auth-access-token=${newAccessToken}`;
    }
    return `auth-refresh-token=${rawCookie}`;
  }

  return rawCookie;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
    }

    const cookie = getAxiomCookie();
    if (!cookie) {
      return NextResponse.json({ error: 'Not configured' }, { status: 401 });
    }

    const cookieString = await buildCookieString(cookie);

    const axiomUrl = new URL('https://api3.axiom.trade/search-v3');
    axiomUrl.searchParams.set('searchQuery', query.trim());
    axiomUrl.searchParams.set('isOg', 'false');
    axiomUrl.searchParams.set('isPumpSearch', 'false');
    axiomUrl.searchParams.set('isBonkSearch', 'false');
    axiomUrl.searchParams.set('isBagsSearch', 'false');
    axiomUrl.searchParams.set('isUsd1Search', 'false');
    axiomUrl.searchParams.set('onlyBonded', 'false');
    axiomUrl.searchParams.set('v', Date.now().toString());

    const response = await fetch(axiomUrl.toString(), {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Origin': 'https://axiom.trade',
        'Referer': 'https://axiom.trade/',
        'Cookie': cookieString,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      cachedAccessToken = null;
      accessTokenExpiry = 0;
      return NextResponse.json(
        { error: 'Failed to search tokens' },
        { status: response.status || 500 }
      );
    }
  } catch (error) {
    console.error('Token search error:', error);
    return NextResponse.json(
      { error: 'Failed to search tokens' },
      { status: 500 }
    );
  }
}
