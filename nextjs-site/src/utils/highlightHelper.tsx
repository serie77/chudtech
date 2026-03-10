// Shared highlighting utility for keyword highlighting in tweets
import React from 'react';

export interface Keyword {
  id: string;
  text: string;
  color: string;
  matchMode: "contains" | "exact";
  sound: string;
}

/**
 * Highlights keywords in text and returns JSX with highlighted spans
 */
export function highlightText(
  text: string,
  keywords: Keyword[],
  highlightingEnabled: boolean
): React.ReactNode {
  if (!highlightingEnabled || keywords.length === 0) {
    return text;
  }

  let parts: Array<{ text: string; color?: string }> = [{ text }];

  keywords.forEach((keyword) => {
    const newParts: Array<{ text: string; color?: string }> = [];

    parts.forEach((part) => {
      if (part.color) {
        newParts.push(part);
        return;
      }

      const textLower = part.text.toLowerCase();
      const keywordLower = keyword.text.toLowerCase();

      if (keyword.matchMode === "exact") {
        const words = part.text.split(/(\s+)/);
        words.forEach((word) => {
          if (word.toLowerCase() === keywordLower) {
            newParts.push({ text: word, color: keyword.color });
          } else {
            newParts.push({ text: word });
          }
        });
      } else {
        const index = textLower.indexOf(keywordLower);
        if (index === -1) {
          newParts.push(part);
        } else {
          if (index > 0) {
            newParts.push({ text: part.text.substring(0, index) });
          }
          newParts.push({
            text: part.text.substring(index, index + keyword.text.length),
            color: keyword.color,
          });
          if (index + keyword.text.length < part.text.length) {
            newParts.push({
              text: part.text.substring(index + keyword.text.length),
            });
          }
        }
      }
    });

    parts = newParts;
  });

  return (
    <>
      {parts.map((part, i) =>
        part.color ? (
          <span
            key={i}
            style={{
              backgroundColor: part.color,
              color: "#000",
              fontWeight: "bold",
              padding: "2px 4px",
              borderRadius: "3px",
            }}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * Check if text contains any keywords and return matching keywords with their sounds
 */
export function getMatchingKeywords(
  text: string,
  keywords: Keyword[]
): Keyword[] {
  const matches: Keyword[] = [];
  const textLower = text.toLowerCase();

  keywords.forEach((keyword) => {
    const keywordLower = keyword.text.toLowerCase();
    const isMatch =
      keyword.matchMode === "exact"
        ? textLower.split(/\s+/).includes(keywordLower)
        : textLower.includes(keywordLower);

    if (isMatch) {
      matches.push(keyword);
    }
  });

  return matches;
}
