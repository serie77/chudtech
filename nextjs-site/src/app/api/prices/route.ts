import { NextResponse } from 'next/server';

let cachedPrices: Record<string, number> = {};
let lastFetch = 0;
const CACHE_MS = 3000; // 3 second cache

const COINS = ['SOL', 'BTC', 'ETH'];

export async function GET() {
  const now = Date.now();

  if (now - lastFetch < CACHE_MS && Object.keys(cachedPrices).length > 0) {
    return NextResponse.json(cachedPrices);
  }

  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'allMids' }),
    });

    if (!res.ok) throw new Error('Hyperliquid API error');

    const data = await res.json();
    const prices: Record<string, number> = {};

    for (const coin of COINS) {
      if (data[coin]) {
        prices[coin] = parseFloat(data[coin]);
      }
    }

    cachedPrices = prices;
    lastFetch = now;

    return NextResponse.json(prices);
  } catch {
    // Return cached if available, otherwise error
    if (Object.keys(cachedPrices).length > 0) {
      return NextResponse.json(cachedPrices);
    }
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 502 });
  }
}
