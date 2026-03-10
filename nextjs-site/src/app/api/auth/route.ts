import { NextRequest, NextResponse } from 'next/server';

// API keys — add yours here
const VALID_KEYS = new Set([
  process.env.CHUD_API_KEY || 'chud-default-key-change-me',
]);

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ valid: false });
    }

    const valid = VALID_KEYS.has(key.trim());
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
