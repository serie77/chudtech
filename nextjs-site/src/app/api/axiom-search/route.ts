import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
  }

  try {
    console.log('🔍 Searching CoinGecko for:', query);
    
    // Use CoinGecko free API (no key needed for search)
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    console.log('📡 Fetching from CoinGecko:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ CoinGecko response received');
    
    // Extract coins from response
    const coinResults = data.coins || [];
    
    // Return top 7 matches with proper formatting
    const coins = coinResults.slice(0, 7).map((coin: any) => ({
      name: coin.name || 'Unknown',
      symbol: (coin.symbol || 'N/A').toUpperCase(),
      image: coin.large || coin.thumb || 'https://via.placeholder.com/100',
      ca: coin.id || '', // CoinGecko uses 'id' as identifier
    }));

    console.log(`✅ Found ${coins.length} coins from CoinGecko for "${query}"`);
    return NextResponse.json({ coins });
  } catch (error) {
    console.error('❌ CoinGecko search error:', error);
    return NextResponse.json({ 
      error: String(error),
      coins: [] 
    }, { status: 200 });
  }
}
