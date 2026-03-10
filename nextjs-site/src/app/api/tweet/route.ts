import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tweetId = searchParams.get('id');

  if (!tweetId) {
    return NextResponse.json({ error: 'Tweet ID is required' }, { status: 400 });
  }

  try {
    // Fetch tweet data from Twitter's syndication API server-side
    const response = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=a`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.user) {
      return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
    }

    // Build media array from photos and videos
    const media: Array<{ type: string; url: string }> = [];
    if (data.photos) {
      for (const photo of data.photos) {
        if (photo.url) media.push({ type: 'image', url: photo.url });
      }
    }
    if (data.video?.variants) {
      const mp4 = data.video.variants
        .filter((v: { type?: string }) => v.type === 'video/mp4')
        .sort((a: { bitrate?: number }, b: { bitrate?: number }) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (mp4?.src) media.push({ type: 'video', url: mp4.src });
    }

    // Return the tweet data
    return NextResponse.json({
      username: `@${data.user.screen_name}`,
      displayName: data.user.name,
      handle: `@${data.user.screen_name}`,
      verified: data.user.verified || data.user.is_blue_verified || false,
      text: data.text || '',
      imageUrl: media.find(m => m.type === 'image')?.url,
      media,
      profilePic: data.user.profile_image_url_https || '',
      twitterStatusId: tweetId,
      timestamp: new Date(data.created_at).toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
      }),
    });
  } catch (error) {
    console.error('Failed to fetch tweet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tweet data' },
      { status: 500 }
    );
  }
}
