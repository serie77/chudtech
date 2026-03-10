import { NextRequest, NextResponse } from 'next/server';

// 1x1 transparent PNG fallback (so <img> onerror fires cleanly)
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJREFUeJztzDEOgDAMBdC/OAMXoGLg/keA3dGxpOkCQuJJ1rd+AgA=',
  'base64'
);

// Detect if URL is a video (needs different fetch headers)
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes('video.twimg.com') ||
    lower.endsWith('.mp4') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.webm') ||
    lower.includes('/ext_tw_video/');
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 400,
      headers: { 'Content-Type': 'image/png' },
    });
  }

  const isVideo = isVideoUrl(imageUrl);

  try {
    const controller = new AbortController();
    // Videos need longer timeout (up to 30s)
    const timeout = setTimeout(() => controller.abort(), isVideo ? 30000 : 10000);

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': isVideo ? '*/*' : 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://x.com/',
        'Sec-Fetch-Dest': isVideo ? 'video' : 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: response.status,
        headers: { 'Content-Type': 'image/png' },
      });
    }

    const contentType = response.headers.get('content-type') || (isVideo ? 'video/mp4' : 'image/jpeg');

    // If upstream returned HTML instead of media (CDN error page), return error
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      return new NextResponse(TRANSPARENT_PIXEL, {
        status: 502,
        headers: { 'Content-Type': 'image/png' },
      });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse(TRANSPARENT_PIXEL, {
      status: 500,
      headers: { 'Content-Type': 'image/png' },
    });
  }
}
