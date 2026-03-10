import { NextRequest } from 'next/server';

// Track connected clients globally
const clients = new Set<ReadableStreamDefaultController>();

function broadcastCount() {
  const count = clients.size;
  const data = `data: ${JSON.stringify({ online: count })}\n\n`;
  for (const controller of clients) {
    try {
      controller.enqueue(new TextEncoder().encode(data));
    } catch {
      clients.delete(controller);
    }
  }
}

export async function GET(request: NextRequest) {
  // Verify auth via cookie (middleware already handles this, but double-check)
  const apiKey = request.cookies.get('chud-api-key')?.value;
  const validKey = process.env.CHUD_API_KEY || 'chud-default-key-change-me';
  if (!apiKey || apiKey !== validKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      clients.add(controller);
      // Send current count to the new client immediately
      const count = clients.size;
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ online: count })}\n\n`));
      // Broadcast updated count to everyone
      broadcastCount();
    },
    cancel(controller) {
      clients.delete(controller);
      broadcastCount();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
