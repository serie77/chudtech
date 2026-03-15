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
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!res.ok) {
      ogCache.set(url, null);
      return NextResponse.json({ image: null });
    }

    // Use final URL after redirects (e.g. t.co → trib.al → dailymail.co.uk)
    const finalUrl = res.url || url;
    const html = await res.text();

    // Extract image from meta tags (allow spaces around = for sites like Daily Mail)
    let image: string | null = null;
    const metaPatterns = [
      // property/name + content (allow spaces around = like `property ="value"`)
      /<meta[\s][^>]*(?:property|name)\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[\s][^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["']og:image["']/i,
      /<meta[\s][^>]*(?:property|name)\s*=\s*["']twitter:image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[\s][^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["']twitter:image["']/i,
      /<meta[\s][^>]*(?:property|name)\s*=\s*["']twitter:image:src["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[\s][^>]*content\s*=\s*["']([^"']+)["'][^>]*(?:property|name)\s*=\s*["']twitter:image:src["']/i,
      // itemprop variant
      /<meta[\s][^>]*itemprop\s*=\s*["']image["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      // <link rel="image_src">
      /<link[^>]*rel\s*=\s*["']image_src["'][^>]*href\s*=\s*["']([^"']+)["']/i,
    ];
    for (const re of metaPatterns) {
      const m = html.match(re);
      if (m) { image = m[1]; break; }
    }

    // Decode HTML entities in image URL
    if (image) {
      image = image.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }

    // Make relative URLs absolute using the FINAL redirected URL
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, finalUrl).href;
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
