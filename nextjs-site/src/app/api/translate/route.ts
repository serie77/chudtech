import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, targetLang = 'en' } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Use MyMemory Translation API (free, no API key needed)
    // Alternative: You could use Google Translate API, DeepL, etc.
    const encodedText = encodeURIComponent(text);
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=auto|${targetLang}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.responseStatus === 200 || data.responseData) {
      return NextResponse.json({
        translatedText: data.responseData.translatedText,
        detectedLanguage: data.responseData.match?.split('-')[0] || 'unknown',
        success: true
      });
    } else {
      throw new Error('Translation failed');
    }
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', success: false },
      { status: 500 }
    );
  }
}
