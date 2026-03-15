import { NextResponse } from 'next/server';
import { getAxiomCookie } from '@/lib/axiom-store';

let cachedAccessToken: string | null = null;
let accessTokenExpiry = 0;

async function tryRefresh(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://api3.axiom.trade/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://axiom.trade',
      'Referer': 'https://axiom.trade/',
      'Cookie': `auth-refresh-token=${refreshToken}`,
    },
    body: '{}',
  });

  let setCookies: string[] = [];
  if (typeof res.headers.getSetCookie === 'function') setCookies = res.headers.getSetCookie();
  if (setCookies.length === 0) {
    const raw = res.headers.get('set-cookie');
    if (raw) setCookies = raw.split(/,(?=\s*\w+=)/);
  }
  for (const sc of setCookies) {
    const match = sc.match(/auth-access-token=([^;]+)/);
    if (match) return match[1];
  }
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (data.accessToken) return data.accessToken;
    if (data.token) return data.token;
  } catch {}
  return null;
}

export async function GET() {
  const cookie = getAxiomCookie();
  if (!cookie) return NextResponse.json({ error: 'Not configured' }, { status: 401 });

  // Return cached if still valid
  if (cachedAccessToken && Date.now() < accessTokenExpiry) {
    return NextResponse.json({ accessToken: cachedAccessToken, expiresAt: accessTokenExpiry });
  }

  // Extract refresh token
  const refreshMatch = cookie.match(/auth-refresh-token=([^;]+)/);
  const refreshToken = refreshMatch ? refreshMatch[1] : cookie.startsWith('eyJ') ? cookie : null;
  if (!refreshToken) return NextResponse.json({ error: 'No refresh token' }, { status: 401 });

  // Check if existing access token in cookie is still valid
  const accessMatch = cookie.match(/auth-access-token=([^;]+)/);
  if (accessMatch) {
    try {
      const payload = JSON.parse(atob(accessMatch[1].split('.')[1]));
      if (payload.exp && payload.exp * 1000 > Date.now() + 30000) {
        cachedAccessToken = accessMatch[1];
        accessTokenExpiry = payload.exp * 1000 - 30000;
        return NextResponse.json({ accessToken: cachedAccessToken, expiresAt: accessTokenExpiry });
      }
    } catch {}
  }

  // Refresh
  for (let i = 0; i < 3; i++) {
    try {
      const token = await tryRefresh(refreshToken);
      if (token) {
        cachedAccessToken = token;
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          accessTokenExpiry = payload.exp ? payload.exp * 1000 - 30000 : Date.now() + 14 * 60 * 1000;
        } catch {
          accessTokenExpiry = Date.now() + 14 * 60 * 1000;
        }
        return NextResponse.json({ accessToken: cachedAccessToken, expiresAt: accessTokenExpiry });
      }
    } catch {}
    if (i < 2) await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });
}
