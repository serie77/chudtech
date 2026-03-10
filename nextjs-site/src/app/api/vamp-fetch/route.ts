import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractAddress } = body;

    if (!contractAddress || typeof contractAddress !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing contractAddress' },
        { status: 400 }
      );
    }

    const response = await fetch('https://j7tracker.com/api/vamp-fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://j7tracker.com',
        'Referer': 'https://j7tracker.com/',
      },
      body: JSON.stringify({ contractAddress }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Vamp fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch token data' },
      { status: 500 }
    );
  }
}
