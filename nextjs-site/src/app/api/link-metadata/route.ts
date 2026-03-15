import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory cache for link metadata (cleared on restart)
const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Twitterbot/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ url, domain: getDomain(url) });
    }

    // Use final URL after redirects (t.co → trib.al → dailymail.co.uk)
    const finalUrl = response.url || url;
    const html = await response.text();

    // Extract Open Graph and meta tags
    const title = extractMeta(html, 'og:title') || extractMeta(html, 'twitter:title') || extractHtmlTitle(html);
    const description = extractMeta(html, 'og:description') || extractMeta(html, 'twitter:description') || extractMeta(html, 'description');
    let image = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image') || extractMeta(html, 'twitter:image:src') || extractLinkImage(html);
    const siteName = extractMeta(html, 'og:site_name');
    const domain = getDomain(finalUrl);

    // Make relative image URLs absolute using the final redirected URL
    if (image && !image.startsWith('http')) {
      try { image = new URL(image, finalUrl).href; } catch {}
    }

    const data = {
      url,
      title: title || undefined,
      description: description || undefined,
      image: image || undefined,
      siteName: siteName || undefined,
      domain,
    };

    // Cache result
    cache.set(url, { data, expires: Date.now() + CACHE_TTL });

    // Prune old entries periodically
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (val.expires < now) cache.delete(key);
      }
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=600' },
    });
  } catch {
    return NextResponse.json({ url, domain: getDomain(url) });
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function extractMeta(html: string, property: string): string | null {
  const esc = escapeRegex(property);
  // Match property/name + content (allow spaces around = like `property ="value"`)
  const patterns = [
    new RegExp(`<meta[\\s][^>]*(?:property|name)\\s*=\\s*["']${esc}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[\\s][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${esc}["']`, 'i'),
    // itemprop variant
    new RegExp(`<meta[\\s][^>]*itemprop\\s*=\\s*["']${esc}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

// Fallback: <link rel="image_src"> or large <img> in article
function extractLinkImage(html: string): string | null {
  const linkMatch = html.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
  if (linkMatch) return decodeHtmlEntities(linkMatch[1]);
  return null;
}

function extractHtmlTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}
