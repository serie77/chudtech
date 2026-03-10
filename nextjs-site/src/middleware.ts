import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_API_ROUTES = ['/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/* routes
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_API_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next();

  // Check cookie or header for the API key
  const apiKey = request.cookies.get('chud-api-key')?.value
    || request.headers.get('x-api-key');

  const validKey = process.env.CHUD_API_KEY || 'chud-default-key-change-me';

  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
