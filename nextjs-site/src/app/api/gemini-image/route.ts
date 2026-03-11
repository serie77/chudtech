import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!prompt || !apiKey) {
      return NextResponse.json({ error: !prompt ? 'Missing prompt' : 'GEMINI_API_KEY not configured' }, { status: 400 });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: `Gemini API error: ${res.status} ${errText}` }, { status: res.status });
    }

    const data = await res.json();

    // Extract image from response
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!parts) {
      return NextResponse.json({ error: 'No response from Gemini' }, { status: 500 });
    }

    // Find the image part (inline_data with mime_type image/*)
    const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) =>
      p.inlineData?.mimeType?.startsWith('image/')
    );

    if (!imagePart?.inlineData) {
      // Maybe only text was returned
      const textPart = parts.find((p: { text?: string }) => p.text);
      return NextResponse.json({ error: textPart?.text || 'No image generated' }, { status: 422 });
    }

    const { mimeType, data: b64 } = imagePart.inlineData;
    return NextResponse.json({
      image: `data:${mimeType};base64,${b64}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
