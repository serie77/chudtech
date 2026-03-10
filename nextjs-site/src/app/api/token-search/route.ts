import { NextRequest, NextResponse } from 'next/server';
import { getAxiomCookie } from '@/lib/axiom-store';

// In-memory cache for the access token (survives across requests, resets on server restart)
let cachedAccessToken: string | null = null;
let accessTokenExpiry: number = 0;

// Use the refresh token to get a fresh access token from Axiom
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    // Hit Axiom with just the refresh token - it should return a new access token
    const res = await fetch('https://api3.axiom.trade/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Origin': 'https://axiom.trade',
        'Referer': 'https://axiom.trade/',
        'Cookie': `auth-refresh-token=${refreshToken}`,
      },
    });

    // Check Set-Cookie headers for new access token
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const sc of setCookies) {
      const match = sc.match(/auth-access-token=([^;]+)/);
      if (match) {
        console.log('[TokenSearch] Got fresh access token from Set-Cookie');
        return match[1];
      }
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

    console.log('[TokenSearch] Refresh response status:', res.status, 'body:', text.slice(0, 200));
    return null;
  } catch (err) {
    console.error('[TokenSearch] Refresh failed:', err);
    return null;
  }
}

// Build cookie string, auto-refreshing the access token if needed
async function buildCookieString(rawCookie: string): Promise<string> {
  // If user pasted a full cookie string (has auth-access-token already), extract parts
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
          // Still valid for at least 30 more seconds, use it and cache it
          cachedAccessToken = accessMatch[1];
          accessTokenExpiry = payload.exp * 1000 - 30000;
          return rawCookie;
        }
      } catch {
        // Can't decode, try refresh
      }
    }

    // Try to get a fresh access token
    console.log('[TokenSearch] Access token expired or missing, refreshing...');
    const newAccessToken = await refreshAccessToken(refreshToken);
    if (newAccessToken) {
      // Cache it (15 min minus 30s buffer)
      cachedAccessToken = newAccessToken;
      try {
        const payload = JSON.parse(atob(newAccessToken.split('.')[1]));
        accessTokenExpiry = payload.exp ? payload.exp * 1000 - 30000 : Date.now() + 14 * 60 * 1000;
      } catch {
        accessTokenExpiry = Date.now() + 14 * 60 * 1000;
      }
      return `auth-refresh-token=${refreshToken}; auth-access-token=${newAccessToken}`;
    }

    // Refresh failed - try with just the refresh token, maybe Axiom accepts it
    console.log('[TokenSearch] Refresh failed, trying with refresh token only');
    return `auth-refresh-token=${refreshToken}`;
  }

  // User pasted something else (maybe just the refresh token value itself)
  // Treat the whole thing as a refresh token
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

  // Fallback: return as-is
  return rawCookie;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
    }

    // Read from universal server-side store
    const cookie = getAxiomCookie();
    if (!cookie) {
      return NextResponse.json({ error: 'Not configured' }, { status: 401 });
    }

    // Auto-refresh access token using the refresh token
    const cookieString = await buildCookieString(cookie);

    // Axiom search-v3 endpoint with all filter params
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
      // Not JSON - return raw text as error
      if (text === 'Resource not found') {
        // Clear cached access token so next request tries to refresh
        cachedAccessToken = null;
        accessTokenExpiry = 0;
        return NextResponse.json(
          { error: 'Axiom session expired. Try refreshing your cookie in Settings > Advanced.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Axiom returned: ${text.slice(0, 200)}` },
        { status: response.status }
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
