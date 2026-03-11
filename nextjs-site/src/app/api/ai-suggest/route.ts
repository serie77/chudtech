import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a Solana memecoin name generator. Given a tweet, extract up to 3 token names people would actually deploy on pump.fun. Return JSON array ONLY.

Format: [{"name":"TokenName","ticker":"TICKER"}]

ABSOLUTE RULE — NO HALLUCINATION:
- Every name and ticker you return MUST be derived from words/phrases that LITERALLY APPEAR in the tweet text.
- NEVER invent names, combine concepts not in the text, or use words from these instructions as suggestions.
- If the tweet only has 1 deployable name, return 1. Do NOT pad with made-up filler.

$CASHTAG EXTRACTION (HIGHEST PRIORITY):
- If the tweet contains $WORD references (dollar sign followed by a word), extract them FIRST. Each $cashtag = its own suggestion.
- The ticker IS the cashtag word (e.g. "$WOJAK" → ticker "WOJAK"). Always use the exact word after the $ sign.
- The name MUST be the ticker word itself, exactly as written — do NOT split, prettify, or expand it. (e.g. "$SIMPLECLAW" → name "SIMPLECLAW", ticker "SIMPLECLAW". NOT "Simple Claw").

ENTITY / PERSON NAME EXTRACTION:
- When the tweet mentions a person, pet, or named entity, extract it.
- For person names: ALWAYS generate ALL THREE of these suggestions:
  1. Full name concatenated as ticker (e.g. "Jahan Dotson" → name "Jahan Dotson", ticker "JAHANDOTSON")
  2. First name only (e.g. name "Jahan", ticker "JAHAN")
  3. Last name only (e.g. name "Dotson", ticker "DOTSON")
- Strip prefixes like "my dog", "my cat", "meet", "this is", "WR", "QB", etc.
- NEVER mash initials+name for tickers (no "JDOT", "MEVANS" style). Use the full name or last name.

CAPITALIZED / ALL-CAPS WORDS (HIGH PRIORITY):
- Words or acronyms written in ALL CAPS in the tweet are intentionally emphasized — treat them as top ticker candidates.
- This includes acronyms like TSA, DHS, FBI, etc. — if they appear capitalized in the tweet, use them as tickers.
- Use the all-caps word itself as the ticker (e.g. "SAVE" → ticker SAVE, "TSA" → ticker TSA).
- When a phrase contains an acronym, the acronym alone should be the ticker for that suggestion.
- The token name can be the full phrase containing the emphasized word.

OTHER PICKS (only from the tweet text):
- Viral catchphrases — use the full phrase as the name
- Coined terms, new slang, or dramatic words from the text
- The most meme-worthy noun or concept from the tweet
- For news tweets: the key subject or event name

TICKER RULES:
- Uppercase, no spaces, max 13 chars
- If the name is a single word that fits in 13 chars, use the FULL WORD as the ticker (e.g. "Cancer" → "CANCER", not "CNCR"). Do NOT abbreviate short words.
- For person names: use the full name without spaces if it fits, or the last name, or the first name. NEVER mash initials+name (no "MEVANS" style tickers).
- Only abbreviate or use acronyms when the name is a multi-word phrase (not a person name) that exceeds 13 chars.
- All suggestions must have DIFFERENT tickers

NEVER pick:
- The @username or account name
- Generic words like "the", "posted", "says", "breaking"
- Words or phrases from these instructions that don't appear in the tweet
- Two suggestions with the same ticker

JSON array only. No explanation.`;

export async function POST(request: NextRequest) {
  try {
    const { account, text } = await request.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!text || !apiKey) {
      return NextResponse.json({ error: !text ? 'Missing text' : 'GROQ_API_KEY not configured' }, { status: 400 });
    }

    const userMessage = `@${account || 'unknown'}: ${text}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 200,
        stream: false,
      }),
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Groq API error: ${res.status}`, details: errText }, { status: res.status });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      return NextResponse.json({ error: 'Empty response from Groq' }, { status: 502 });
    }

    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(content);
    } catch {
      try {
        // Strip code fences, leading text, etc. — find the JSON array/object
        const match = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
        if (!match) {
          return NextResponse.json({ error: 'No JSON found in Groq response', raw: content }, { status: 502 });
        }
        parsed = JSON.parse(match[0]);
      } catch {
        return NextResponse.json({ error: 'Failed to parse Groq response', raw: content }, { status: 502 });
      }
    }

    // Support both array (new) and object (legacy) responses
    if (Array.isArray(parsed)) {
      const suggestions = parsed
        .filter((s: { name?: string }) => s.name)
        .slice(0, 3)
        .map((s: { name: string; ticker?: string }) => ({ name: s.name, ticker: s.ticker || '' }));
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({
      suggestions: [{ name: parsed.name || '', ticker: parsed.ticker || '' }],
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Groq request timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
