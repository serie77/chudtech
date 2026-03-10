import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address parameter is required' }, { status: 400 });
  }

  try {
    // Use Solscan API to get account info
    const response = await fetch(`https://api.solscan.io/account?address=${address}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Solscan API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Return balance in SOL (lamports / 1000000000)
    const balanceSOL = data.lamports ? data.lamports / 1000000000 : 0;
    
    return NextResponse.json({ 
      balance: balanceSOL,
      lamports: data.lamports || 0
    });
  } catch (error) {
    console.error('Solscan fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance from Solscan' },
      { status: 500 }
    );
  }
}
