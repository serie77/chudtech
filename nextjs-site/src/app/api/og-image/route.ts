import { NextRequest, NextResponse } from 'next/server';

// Cache OG images to avoid refetching
const ogCache = new Map<string, string | null>();

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ image: null });

  // Check cache
  if (ogCache.has(url)) {
    return NextResponse.json({ image: ogCache.get(url) });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      ogCache.set(url, null);
      return NextResponse.json({ image: null });
    }

    const html = await res.text();

    // Extract og:image
    let image: string | null = null;
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch) {
      image = ogMatch[1];
    }

    // Fallback: twitter:image
    if (!image) {
      const twMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
      if (twMatch) image = twMatch[1];
    }

    // Make relative URLs absolute
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, url).href;
      } catch {}
    }

    ogCache.set(url, image);

    // Cap cache size
    if (ogCache.size > 500) {
      const firstKey = ogCache.keys().next().value;
      if (firstKey) ogCache.delete(firstKey);
    }

    return NextResponse.json({ image });
  } catch {
    ogCache.set(url, null);
    return NextResponse.json({ image: null });
  }
}
