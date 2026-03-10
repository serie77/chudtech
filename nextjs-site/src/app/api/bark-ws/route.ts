import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const upgradeHeader = request.headers.get('upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // Unfortunately, Next.js doesn't support WebSocket upgrades in API routes
  // We need to use a different approach - Server-Sent Events or a separate WebSocket server
  
  return new Response('WebSocket proxy not supported in Next.js API routes. Use direct connection or deploy a separate WebSocket proxy.', {
    status: 501
  });
}
