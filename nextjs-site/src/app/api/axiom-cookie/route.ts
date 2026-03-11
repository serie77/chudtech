import { NextRequest, NextResponse } from 'next/server';
import { getAxiomCookie, setAxiomCookie } from '@/lib/axiom-store';

// POST: Set the universal Axiom cookie
export async function POST(request: NextRequest) {
  try {
    const { cookie } = await request.json();

    if (!cookie || typeof cookie !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid cookie value' }, { status: 400 });
    }

    setAxiomCookie(cookie.trim());
    console.log('[AxiomCookie] Universal cookie updated');
    return NextResponse.json({ success: true, message: 'Axiom cookie set' });
  } catch (error) {
    console.error('[AxiomCookie] Error setting cookie:', error);
    return NextResponse.json({ error: 'Failed to set cookie' }, { status: 500 });
  }
}

// GET: Check if a universal Axiom cookie is configured
export async function GET() {
  const cookie = getAxiomCookie();
  return NextResponse.json({
    configured: !!cookie,
    length: cookie ? cookie.length : 0,
    source: cookie ? (process.env.AXIOM_REFRESH_TOKEN && cookie === process.env.AXIOM_REFRESH_TOKEN ? 'env' : 'admin/file') : 'none',
    preview: cookie ? cookie.slice(0, 40) + '...' : null,
  });
}

// DELETE: Clear the universal Axiom cookie
export async function DELETE() {
  setAxiomCookie(null);
  console.log('[AxiomCookie] Universal cookie cleared');
  return NextResponse.json({ success: true, message: 'Axiom cookie cleared' });
}
