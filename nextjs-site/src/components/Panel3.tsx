"use client";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { getTheme } from "@/utils/themes";
import { ExternalLink } from "lucide-react";
import { storeGet, storeSet } from "@/lib/store";

interface AiHighlight {
  name: string;
  ticker: string;
  images: string[];
  suggestions?: Array<{ name: string; ticker: string }>;
}

interface Tweet {
  id: string;
  twitterStatusId?: string;
  username: string;
  displayName: string;
  handle: string;
  verified: boolean;
  timestamp: string;
  text: string;
  imageUrl?: string;
  profilePic: string;
  highlightColor?: string;
  isRetweet?: boolean;
  isReply?: boolean;
  isQuote?: boolean;
  tweetType?: string;
  media?: Array<{ type: 'image' | 'video' | 'gif'; url: string; thumbnail?: string }>;
  originalAuthorHandle?: string;
  quotedTweet?: Tweet;
  repliedToTweet?: Tweet;
  linkPreviews?: Array<{
    url: string;
    title?: string;
    description?: string;
    image?: string;
    domain?: string;
  }>;
  followedUser?: {
    handle: string;
    displayName: string;
    profilePic: string;
    bio?: string;
    followers?: string;
    url?: string;
  };
}

interface Panel3Props {
  themeId: string;
  tweets: Tweet[];
  customNotifications: Array<{ username: string; color: string; sound: string }>;
  defaultColor: string;
  onTweetAdded?: (tweet: Tweet) => void;
  onDeploy?: (images: string[], twitterUrl: string) => void;
  onFollowDeploy?: (name: string, symbol: string, imageUrl: string, twitterUrl: string) => void;
  aiResults?: Record<string, AiHighlight>;
  onAiDeploy?: (name: string, ticker: string, imageUrl: string, tweetId: string, platform: string) => void;
  onAiFillForm?: (name: string, ticker: string, images: string[], tweetId: string) => void;
  browserImages?: Array<{ name: string; nameWithoutExt: string; filename: string }>;
  feedPaused?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  bufferedCount?: number;
  onClearFeed?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────

const px = (url: string | undefined) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/')) return url; // Already a local URL, no proxy needed
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

const avatarColor = (name: string): string => {
  const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

const hideOnError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const container = (e.target as HTMLImageElement).closest('[data-mc]');
  if (container) (container as HTMLElement).style.display = 'none';
};

const fmtTime = (ts: string): string => {
  try { return new Date(ts).toLocaleTimeString('en-GB', { hour12: false }); }
  catch { return '--:--:--'; }
};

const renderText = (text: string) => {
  const parts = text.split(/((?:@[\w]+)|(?:https?:\/\/[^\s<>"{}|\\^`\[\]]+))/g);
  return parts.map((part, i) => {
    if (part.startsWith('@'))
      return <a key={i} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>;
    if (part.startsWith('http'))
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>;
    return part;
  });
};

const collectAllImages = (tweet: Tweet): string[] => {
  const imgs: string[] = [];
  const add = (url: string) => { if (url && !imgs.includes(url)) imgs.push(url); };
  tweet.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.imageUrl) add(tweet.imageUrl);
  tweet.quotedTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.quotedTweet?.imageUrl) add(tweet.quotedTweet.imageUrl);
  tweet.repliedToTweet?.media?.forEach(m => { if (m.type !== 'video') add(m.url); else if (m.thumbnail) add(m.thumbnail); });
  if (tweet.repliedToTweet?.imageUrl) add(tweet.repliedToTweet.imageUrl);
  // Link preview images (enriched with OG images at tweet arrival time)
  tweet.linkPreviews?.forEach(lp => { if (lp.image) add(lp.image); });
  // Followed user profile pic (follow events)
  if (tweet.followedUser?.profilePic) add(tweet.followedUser.profilePic);
  if (tweet.profilePic) add(tweet.profilePic);
  if (tweet.quotedTweet?.profilePic) add(tweet.quotedTweet.profilePic);
  if (tweet.repliedToTweet?.profilePic) add(tweet.repliedToTweet.profilePic);
  return imgs;
};

// ─── Avatar ──────────────────────────────────────────────────────

const Avatar = memo(function Avatar({ src, name, size = 36 }: { src?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const letter = name[0]?.toUpperCase() || '?';

  if (!src || failed) {
    return (
      <div
        className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
        style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.4 }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={px(src)}
      alt={name}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
});

// ─── Video Thumbnail ─────────────────────────────────────────────

const VideoThumbnail = memo(function VideoThumbnail({ url }: { url: string }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = px(url);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.src = '';
      video.load();
    };

    const onLoaded = () => { video.currentTime = Math.min(1, video.duration * 0.1); };
    const onSeeked = () => {
      try {
        const c = document.createElement('canvas');
        c.width = video.videoWidth || 320;
        c.height = video.videoHeight || 180;
        const ctx = c.getContext('2d');
        if (ctx) { ctx.drawImage(video, 0, 0, c.width, c.height); setThumb(c.toDataURL('image/jpeg', 0.8)); }
      } catch { /* ignore */ }
      cleanup();
    };
    const onError = () => cleanup();

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    const timer = setTimeout(cleanup, 15000);
    return () => { clearTimeout(timer); cleanup(); };
  }, [url]);

  if (!thumb) return null;
  return (
    <div className="relative bg-black overflow-hidden" data-mc style={{ maxHeight: 300 }}>
      <img src={thumb} alt="" className="w-full h-full object-cover" style={{ maxHeight: 300 }} />
      <div className="absolute bottom-1.5 left-1.5 bg-black/70 rounded px-1.5 py-0.5 flex items-center gap-1">
        <svg className="w-2.5 h-2.5 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        <span className="text-[9px] text-white/70 font-bold">VIDEO</span>
      </div>
    </div>
  );
});

// ─── Media Grid ──────────────────────────────────────────────────

const MediaGrid = memo(function MediaGrid({ media }: { media: Array<{ type: string; url: string; thumbnail?: string }> }) {
  const images = media.filter(m => m.type === 'image' || m.type === 'gif');
  const videos = media.filter(m => m.type === 'video');
  const count = Math.min(images.length, 4);

  return (
    <div className="mt-2.5">
      {count > 0 && (
        <div
          className="grid gap-0.5 rounded-lg overflow-hidden"
          style={{ gridTemplateColumns: count === 1 ? '1fr' : '1fr 1fr' }}
        >
          {images.slice(0, 4).map((item, i) => (
            <div key={i} className="relative bg-black overflow-hidden" data-mc style={{ maxHeight: count === 1 ? 300 : 180 }}>
              <img
                src={px(item.url)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                style={{ maxHeight: count === 1 ? 300 : 180 }}
                onError={hideOnError}
              />
            </div>
          ))}
        </div>
      )}
      {/* Videos with poster thumbnails + canvas fallback */}
      {videos.map((v, i) => (
        <div key={`v-${i}`} className="mt-1 rounded-lg overflow-hidden bg-black relative" data-mc>
          {!v.thumbnail && <VideoThumbnail url={v.url} />}
          <video
            src={px(v.url)}
            controls
            preload="metadata"
            poster={v.thumbnail ? px(v.thumbnail) : undefined}
            className="w-full max-h-56"
            style={{ maxHeight: 224 }}
          />
        </div>
      ))}
    </div>
  );
});

// ─── Embed Card (for quoted / replied / retweeted content) ───────

const EmbedCard = memo(function EmbedCard({ tweet, renderFn }: { tweet: Tweet; renderFn?: (text: string) => React.ReactNode[] }) { return (
  <div className="mt-2.5 border-l-2 border-white/[0.10] rounded-r-lg pl-3 py-2 pr-2 bg-white/[0.02]">
    <div className="flex items-center gap-1.5 mb-1">
      <Avatar src={tweet.profilePic} name={tweet.username} size={16} />
      <span className="text-white/60 font-semibold text-[11px] truncate">{tweet.displayName}</span>
      <a
        href={`https://x.com/${tweet.username}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white/30 text-[11px] hover:underline"
      >
        @{tweet.username}
      </a>
    </div>
    {tweet.text && (
      <p className="text-white/50 text-[13px] font-medium leading-relaxed whitespace-pre-wrap break-words select-text">
        {renderFn ? renderFn(tweet.text) : renderText(tweet.text)}
      </p>
    )}
    {tweet.imageUrl && (
      !tweet.media?.length ||
      (tweet.media.length > 0 && !tweet.media.some(m => m.type === 'image' || m.type === 'gif') && !tweet.media.some(m => m.url === tweet.imageUrl))
    ) && (
      <div className="mt-2 rounded-lg overflow-hidden" data-mc>
        <img src={px(tweet.imageUrl)} alt="" className="w-full max-h-48 object-cover" loading="lazy" onError={hideOnError} />
      </div>
    )}
    {tweet.media && tweet.media.length > 0 && <MediaGrid media={tweet.media} />}
  </div>
); });

// ─── Link Preview ────────────────────────────────────────────────

const LinkPreviewCard = memo(function LinkPreviewCard({ link }: { link: { url: string; title?: string; description?: string; image?: string; domain?: string } }) {
  const [meta, setMeta] = useState(link);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (meta.title && meta.image) return;
    if (fetched) return;
    setFetched(true);
    fetch(`/api/link-metadata?url=${encodeURIComponent(link.url)}`)
      .then(r => r.json())
      .then(d => {
        // Write back to the original link object so collectAllImages can see it
        if (d.image && !link.image) link.image = d.image;
        if (d.title && !link.title) link.title = d.title;
        if (d.description && !link.description) link.description = d.description;
        if (d.domain && !link.domain) link.domain = d.domain || d.siteName;
        setMeta(p => ({ url: p.url, title: p.title || d.title, description: p.description || d.description, image: p.image || d.image, domain: p.domain || d.domain || d.siteName }));
      })
      .catch(() => {});
  }, [link.url, fetched, meta.title, meta.image]);

  if (fetched && !meta.title && !meta.image && !meta.description) return null;

  return (
    <a href={meta.url} target="_blank" rel="noopener noreferrer" className="block border border-white/[0.06] rounded-lg overflow-hidden hover:border-white/[0.12] transition-colors bg-white/[0.02] mt-2.5">
      {meta.image && (
        <div className="bg-black" data-mc>
          <img src={px(meta.image)} alt="" className="w-full max-h-48 object-cover" loading="lazy" onError={hideOnError} />
        </div>
      )}
      <div className="px-3 py-2.5">
        {meta.domain && <div className="flex items-center gap-1 text-white/20 text-[11px] mb-1"><ExternalLink size={10} /><span>{meta.domain}</span></div>}
        {meta.title ? <div className="text-white/90 font-medium text-sm line-clamp-2">{meta.title}</div> : !fetched ? <div className="text-white/40 text-xs">Loading...</div> : <div className="text-sky-400 text-xs truncate">{meta.url}</div>}
        {meta.description && <div className="text-white/40 text-xs line-clamp-2 mt-0.5">{meta.description}</div>}
      </div>
    </a>
  );
});

// ─── Action Line ─────────────────────────────────────────────────

const ActionLine = memo(function ActionLine({ tweet }: { tweet: Tweet }) {
  if (tweet.isRetweet && tweet.originalAuthorHandle) {
    return (
      <div className="text-[11px] mb-1.5">
        <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@{tweet.username}</a>
        <span className="text-white/35"> retweeted </span>
        <span className="text-purple-400">{tweet.originalAuthorHandle}</span>
      </div>
    );
  }
  if (tweet.isReply && tweet.repliedToTweet) {
    return (
      <div className="text-[11px] mb-1.5">
        <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@{tweet.username}</a>
        <span className="text-white/35"> replied to </span>
        <a href={`https://x.com/${tweet.repliedToTweet.username}`} target="_blank" rel="noopener noreferrer" className="text-purple-400/80 hover:underline">@{tweet.repliedToTweet.username}</a>
      </div>
    );
  }
  if (tweet.isQuote && tweet.quotedTweet) {
    return (
      <div className="text-[11px] mb-1.5">
        <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@{tweet.username}</a>
        <span className="text-white/35"> quoted </span>
        <a href={`https://x.com/${tweet.quotedTweet.username}`} target="_blank" rel="noopener noreferrer" className="text-purple-400/80 hover:underline">@{tweet.quotedTweet.username}</a>
      </div>
    );
  }
  if (tweet.tweetType === 'FOLLOW' || tweet.tweetType === 'UNFOLLOW') {
    return null;
  }
  return (
    <div className="text-[11px] mb-1.5">
      <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">@{tweet.username}</a>
      <span className="text-white/35"> posted</span>
    </div>
  );
});

// ─── Tweet Card (memoized for smooth scrolling) ─────────────────

interface TweetCardProps {
  tweet: Tweet;
  tweetAi?: AiHighlight;
  deployBtnPosition: 'left' | 'right' | 'top-right';
  deployBtnScale: number;
  onDeploy?: (images: string[], twitterUrl: string) => void;
  onFollowDeploy?: (name: string, symbol: string, imageUrl: string, twitterUrl: string) => void;
  onHighlightMouseDown: (e: React.MouseEvent, tweetId: string, ai: AiHighlight) => void;
}

const buildUrl = (t: Tweet) => {
  if (t.twitterStatusId) {
    // Strip any non-numeric prefix (e.g. "bark-", "bark-deleted-", "bark-truth-")
    const numericId = t.twitterStatusId.replace(/^[a-zA-Z-]+/, '');
    if (numericId && /^\d+$/.test(numericId)) {
      return `https://x.com/${t.username}/status/${numericId}`;
    }
  }
  return `https://x.com/${t.username}`;
};

const TweetCard = memo(function TweetCard({ tweet, tweetAi, deployBtnPosition, deployBtnScale, onDeploy, onFollowDeploy, onHighlightMouseDown }: TweetCardProps) {
  const isDeleted = tweet.tweetType === 'DELETED';

  const handleDeploy = useCallback(() => {
    const allImages = collectAllImages(tweet);
    if (onDeploy && allImages.length > 0) onDeploy(allImages, buildUrl(tweet));
    const nameInput = document.querySelector('input[placeholder="Name"]') as HTMLInputElement;
    if (nameInput) nameInput.focus();
  }, [tweet, onDeploy]);

  // Render text with AI highlight
  const renderTextWithAi = useCallback((text: string, tweetId: string, ai?: AiHighlight) => {
    const parts = text.split(/((?:@[\w]+)|(?:https?:\/\/[^\s<>"{}|\\^`\[\]]+))/g);

    if (!ai) {
      return parts.map((part, i) => {
        if (part.startsWith('@'))
          return <a key={i} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>;
        if (part.startsWith('http'))
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>;
        return part;
      });
    }

    const highlightName = ai.name;
    const result: React.ReactNode[] = [];

    parts.forEach((part, i) => {
      if (part.startsWith('@')) {
        result.push(<a key={i} href={`https://x.com/${part.slice(1)}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>);
        return;
      }
      if (part.startsWith('http')) {
        result.push(<a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{part}</a>);
        return;
      }

      const escaped = highlightName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tickerEscaped = ai.ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patterns = [`\\$${tickerEscaped}`, escaped];
      if (ai.ticker.toLowerCase() !== highlightName.toLowerCase()) patterns.push(tickerEscaped);
      const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
      const subParts = part.split(regex);

      subParts.forEach((sub, j) => {
        const subLower = sub.toLowerCase();
        if (subLower === highlightName.toLowerCase() || subLower === `$${ai.ticker.toLowerCase()}` || subLower === ai.ticker.toLowerCase()) {
          result.push(
            <span
              key={`${i}-${j}`}
              className="text-emerald-400 font-semibold cursor-pointer select-none relative"
              style={{
                textShadow: '0 0 8px rgba(16,185,129,0.4)',
                borderBottom: '1px dashed rgba(16,185,129,0.5)',
              }}
              onMouseDown={(e) => onHighlightMouseDown(e, tweetId, ai)}
              title={`Deploy $${ai.ticker}`}
            >
              {sub}
            </span>
          );
        } else {
          result.push(<span key={`${i}-${j}`}>{sub}</span>);
        }
      });
    });

    return result;
  }, [onHighlightMouseDown]);

  const tweetBody = (
    <>
      {/* Header: avatar + name + handle | timestamp + actions */}
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar src={tweet.profilePic} name={tweet.username} size={30} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white/90 font-semibold text-[12px] truncate">{tweet.displayName}</span>
            {tweet.verified && (
              <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
              </svg>
            )}
            <span className="text-white/20 text-[10px] tabular-nums flex-shrink-0">{fmtTime(tweet.timestamp)}</span>
          </div>
          <div className="flex items-center gap-1">
            <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-white/25 text-[11px] hover:underline truncate">@{tweet.username}</a>
            {tweet.followedUser?.followers && (
              <>
                <span className="text-white/10 text-[10px]">·</span>
                <span className="text-white/15 text-[10px]">{tweet.followedUser.followers}</span>
              </>
            )}
            <a
              href={buildUrl(tweet)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-4 h-4 rounded flex items-center justify-center text-white/15 hover:text-white/40 transition-colors"
              title="Open tweet"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" /></svg>
            </a>
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(buildUrl(tweet)); }}
              className="w-4 h-4 rounded flex items-center justify-center text-white/15 hover:text-white/40 transition-colors"
              title="Copy link"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Action line */}
      <ActionLine tweet={tweet} />

      {/* Deleted badge */}
      {isDeleted && (
        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 mb-1.5">
          <svg className="w-2.5 h-2.5 text-red-400/70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="text-red-400/70 text-[9px] font-semibold tracking-wide">DELETED</span>
        </div>
      )}

      {/* Tweet text with AI highlights */}
      {tweet.text && (
        <p className="text-white/65 text-[13px] font-medium leading-[1.5] whitespace-pre-wrap break-words select-text">
          {renderTextWithAi(
            isDeleted ? tweet.text.replace(/^🗑️ DELETED TWEET:\n?/, '') : tweet.text,
            tweet.id,
            tweetAi
          )}
        </p>
      )}

      {/* Follow card */}
      {tweet.followedUser && (tweet.tweetType === 'FOLLOW' || tweet.tweetType === 'UNFOLLOW') && (
        <div className="mt-2 border border-white/[0.04] rounded-md p-2.5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Avatar src={tweet.followedUser.profilePic} name={tweet.followedUser.handle} size={44} />
            <div className="flex-1 min-w-0">
              <span className="text-white/90 font-semibold text-sm block">{tweet.followedUser.displayName}</span>
              <span className="text-white/40 text-xs block">@{tweet.followedUser.handle}</span>
              {tweet.followedUser.bio && <p className="text-white/50 text-xs mt-1.5 leading-relaxed line-clamp-2">{tweet.followedUser.bio}</p>}
              {tweet.followedUser.followers && <span className="text-white/20 text-[11px] mt-1 block">{tweet.followedUser.followers} followers</span>}
            </div>
            <button
              onClick={() => {
                if (onFollowDeploy && tweet.followedUser) {
                  onFollowDeploy(
                    tweet.followedUser.displayName,
                    tweet.followedUser.handle,
                    tweet.followedUser.profilePic || '',
                    `https://x.com/${tweet.followedUser.handle}`
                  );
                }
              }}
              className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 hover:text-blue-300 font-semibold text-[11px] rounded border border-blue-500/25 hover:border-blue-500/40 transition-all flex-shrink-0"
            >
              DEPLOY
            </button>
          </div>
        </div>
      )}

      {/* Replied-to embed */}
      {tweet.repliedToTweet && <EmbedCard tweet={tweet.repliedToTweet} />}

      {/* Standalone image — show when no media, or media has only videos without thumbnails */}
      {tweet.imageUrl && (
        !tweet.media?.length ||
        (tweet.media.length > 0
          && !tweet.media.some(m => m.type === 'image' || m.type === 'gif')
          && !tweet.media.some(m => m.url === tweet.imageUrl)
          && !tweet.media.some(m => m.type === 'video' && m.thumbnail))
      ) && (
        <div className="mt-2.5 rounded-lg overflow-hidden" data-mc>
          <img src={px(tweet.imageUrl)} alt="" className="w-full max-h-72 object-cover" loading="lazy" onError={hideOnError} />
        </div>
      )}

      {/* Media grid */}
      {tweet.media && tweet.media.length > 0 && <MediaGrid media={tweet.media} />}

      {/* Quoted tweet embed — pass AI highlights for retweets */}
      {tweet.quotedTweet && (
        <EmbedCard
          tweet={tweet.quotedTweet}
          renderFn={tweetAi ? (text: string) => renderTextWithAi(text, tweet.id, tweetAi) : undefined}
        />
      )}

      {/* Link previews */}
      {tweet.linkPreviews && tweet.linkPreviews.length > 0 && tweet.linkPreviews.map((link, i) => <LinkPreviewCard key={i} link={link} />)}
    </>
  );

  return (
    <div
      className="rounded-md border overflow-hidden relative tweet-card"
      style={{
        contain: 'content',
        background: isDeleted ? 'rgba(220,38,38,0.06)' : tweet.highlightColor ? `${tweet.highlightColor}08` : 'transparent',
        borderColor: isDeleted ? 'rgba(220,38,38,0.15)' : tweet.highlightColor ? `${tweet.highlightColor}30` : 'rgba(255,255,255,0.04)',
      }}
    >
      {isDeleted && (
        <div className="absolute top-0 left-0 w-[3px] h-full bg-red-500/40 rounded-l" />
      )}

      {deployBtnPosition === 'left' ? (
        <div className="flex">
          <button
            onClick={handleDeploy}
            className="w-[32px] flex-shrink-0 flex flex-col items-center justify-center gap-2 bg-white/[0.03] hover:bg-blue-500/10 text-white/40 hover:text-blue-400 transition-all border-r border-white/[0.06]"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="font-bold text-[7px] uppercase tracking-wider">DEPLOY</span>
          </button>
          <div className="flex-1 min-w-0 px-3 py-2.5">
            {tweetBody}
          </div>
        </div>
      ) : deployBtnPosition === 'right' ? (
        <div className="relative">
          <div className="px-3 py-2.5">
            {tweetBody}
          </div>
          <button
            onClick={handleDeploy}
            className="absolute top-0 right-0 bottom-0 w-[32px] flex flex-col items-center justify-center gap-2 bg-white/[0.02] hover:bg-blue-500/10 text-white/30 hover:text-blue-400 transition-all border-l border-white/[0.06]"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="font-bold text-[7px] uppercase tracking-wider">DEPLOY</span>
          </button>
        </div>
      ) : (
        /* top-right: deploy button overlaid as a corner tab */
        <div className="relative">
          <div className="px-3 py-2.5">
            {tweetBody}
          </div>
          <button
            onClick={handleDeploy}
            className="absolute top-0 right-0 flex items-center gap-1 bg-white/[0.03] hover:bg-blue-500/10 text-white/40 hover:text-blue-400 font-semibold border-l border-b border-white/[0.06] rounded-bl transition-colors"
            style={{
              fontSize: `${10 * deployBtnScale / 100}px`,
              padding: `${6 * deployBtnScale / 100}px ${10 * deployBtnScale / 100}px`,
            }}
          >
            <svg style={{ width: `${12 * deployBtnScale / 100}px`, height: `${12 * deployBtnScale / 100}px` }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            DEPLOY
          </button>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison: only re-render if tweet data or AI result actually changed
  return prev.tweet === next.tweet
    && prev.tweetAi === next.tweetAi
    && prev.deployBtnPosition === next.deployBtnPosition
    && prev.deployBtnScale === next.deployBtnScale
    && prev.onDeploy === next.onDeploy
    && prev.onFollowDeploy === next.onFollowDeploy
    && prev.onHighlightMouseDown === next.onHighlightMouseDown;
});

// ─── Main Panel3 ─────────────────────────────────────────────────

export default function Panel3({ themeId, tweets, customNotifications, defaultColor, onDeploy, onFollowDeploy, aiResults, onAiDeploy, onAiFillForm, browserImages = [], feedPaused, onHoverChange, bufferedCount = 0, onClearFeed }: Panel3Props) {
  const theme = getTheme(themeId);

  // Deploy button position/scale from localStorage
  const [deployBtnPosition, setDeployBtnPosition] = useState<'left' | 'right' | 'top-right'>('right');
  const [deployBtnScale, setDeployBtnScale] = useState(100);

  useEffect(() => {
    const pos = storeGet('nnn-deploy-btn-position');
    if (pos === 'left' || pos === 'right' || pos === 'top-right') setDeployBtnPosition(pos);
    const scale = parseInt(storeGet('nnn-deploy-btn-scale') || '100', 10);
    if (scale >= 60 && scale <= 200) setDeployBtnScale(scale);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nnn-deploy-btn-position') {
        const v = e.newValue;
        if (v === 'left' || v === 'right' || v === 'top-right') setDeployBtnPosition(v);
      }
      if (e.key === 'nnn-deploy-btn-scale') {
        const v = parseInt(e.newValue || '100', 10);
        if (v >= 60 && v <= 200) setDeployBtnScale(v);
      }
    };
    const onCustom = (e: Event) => {
      const { position, scale } = (e as CustomEvent).detail;
      if (position === 'left' || position === 'right' || position === 'top-right') setDeployBtnPosition(position);
      if (typeof scale === 'number' && scale >= 60 && scale <= 200) setDeployBtnScale(scale);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('nnn-deploy-btn-change', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('nnn-deploy-btn-change', onCustom);
    };
  }, []);

  // AI highlight popup state
  const [popup, setPopup] = useState<{
    tweetId: string;
    name: string;
    ticker: string;
    images: string[];
    selectedImage: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    mouseDownTime: number;
  } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupStateRef = useRef(popup);
  popupStateRef.current = popup;

  // Use ref so handleHighlightMouseDown always sees latest browserImages
  const browserImagesRef = useRef(browserImages);
  browserImagesRef.current = browserImages;

  // Read AI click mode from localStorage — re-read on every render so setting changes take effect immediately
  const aiClickModeRef = useRef<'hold' | 'click'>('hold');
  const readAiClickMode = () => {
    try {
      const v = storeGet('nnn-ai-click-mode');
      if (v === 'hold' || v === 'click') aiClickModeRef.current = v;
    } catch {}
  };
  readAiClickMode();

  // Global mouseup: behavior depends on click mode
  useEffect(() => {
    if (!popup) return;

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const p = popupStateRef.current;
      if (!p) return;

      if (popupRef.current?.contains(e.target as Node)) return;

      const mode = aiClickModeRef.current;

      if (mode === 'click') {
        const dist = Math.hypot(e.clientX - p.originX, e.clientY - p.originY);
        // If user dragged far, treat as drag-to-deploy (fill form) even in click mode
        if (dist > 80) {
          onAiFillForm?.(p.name, p.ticker, p.images, p.tweetId);
          setPopup(null);
          return;
        }
        // Quick release from initial click — keep popup open
        const elapsed = Date.now() - p.mouseDownTime;
        if (elapsed < 500) return;
        // Clicked outside after popup was open — close it
        setPopup(null);
        return;
      }

      const dist = Math.hypot(e.clientX - p.originX, e.clientY - p.originY);

      if (p.selectedImage === -1) {
        // Hovering over cancel X — just close
      } else if (dist < 50) {
        const img = p.images[p.selectedImage] || '';
        onAiDeploy?.(p.name, p.ticker, img, p.tweetId, 'Use Account Default');
      } else if (dist > 80) {
        onAiFillForm?.(p.name, p.ticker, p.images, p.tweetId);
      }
      setPopup(null);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setPopup(null);
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [popup, onAiDeploy, onAiFillForm]);

  // Auto-hide popup after 4s
  useEffect(() => {
    if (!popup) return;
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    const hideDelay = aiClickModeRef.current === 'click' ? 8000 : 4000;
    popupTimeoutRef.current = setTimeout(() => {
      setPopup(null);
    }, hideDelay);
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, [popup]);

  // Stable callback for AI highlight mousedown — passed to each TweetCard
  const handleHighlightMouseDown = useCallback((
    e: React.MouseEvent,
    tweetId: string,
    ai: AiHighlight
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();

    const allImages = [...ai.images];
    const currentBrowserImages = browserImagesRef.current;
    if (currentBrowserImages.length > 0) {
      const terms = new Set<string>();
      ai.name.toLowerCase().split(/\s+/).filter(w => w.length >= 2).forEach(w => terms.add(w));
      const tickerLower = ai.ticker.toLowerCase();
      if (tickerLower.length >= 2) terms.add(tickerLower);

      const matching = currentBrowserImages.filter(img => {
        const fn = img.nameWithoutExt.toLowerCase();
        if (fn.length < 2) return false;
        for (const term of terms) {
          if (fn.includes(term) || term.includes(fn)) return true;
        }
        return false;
      });
      matching.forEach(img => {
        const serveUrl = `/api/local-images/serve?file=${encodeURIComponent(img.filename)}`;
        if (!allImages.includes(serveUrl)) allImages.push(serveUrl);
      });
    }

    setPopup({
      tweetId,
      name: ai.name,
      ticker: ai.ticker,
      images: allImages,
      selectedImage: 0,
      x: rect.left + rect.width / 2,
      y: rect.top,
      originX: e.clientX,
      originY: e.clientY,
      mouseDownTime: Date.now(),
    });
  }, []);

  const handlePopupImageClick = useCallback((e: React.MouseEvent, imageIndex: number) => {
    e.stopPropagation();
    const p = popupStateRef.current;
    if (!p) return;
    const img = p.images[imageIndex] || '';
    onAiDeploy?.(p.name, p.ticker, img, p.tweetId, 'Use Account Default');
    setPopup(null);
  }, [onAiDeploy]);

  // Stabilize callbacks passed to TweetCard so they don't change on every render
  const stableOnDeploy = useCallback((images: string[], twitterUrl: string) => {
    onDeploy?.(images, twitterUrl);
  }, [onDeploy]);

  const stableOnFollowDeploy = useCallback((name: string, symbol: string, imageUrl: string, twitterUrl: string) => {
    onFollowDeploy?.(name, symbol, imageUrl, twitterUrl);
  }, [onFollowDeploy]);

  return (
    <div
      className={`h-full ${theme.panel1ContentBg} glass-panel flex flex-col overflow-hidden`}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
    >
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-label">Feed</span>
          {tweets.length > 0 && (
            <span className="text-[10px] text-white/25 font-medium">{tweets.length}</span>
          )}
        </div>
        {tweets.length > 0 && onClearFeed && (
          <button
            onClick={onClearFeed}
            className="text-[9px] text-white/20 hover:text-white/50 transition-colors"
            title="Clear feed"
          >
            Clear
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto relative">
      {/* Pause indicator */}
      {feedPaused && (
        <div className="absolute top-2 left-0 right-0 z-40 flex justify-center pointer-events-none">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/[0.08] backdrop-blur-sm">
            <div className="flex gap-[3px]">
              <div className="w-[3px] h-[10px] rounded-sm bg-white/50" />
              <div className="w-[3px] h-[10px] rounded-sm bg-white/50" />
            </div>
            <span className="text-[10px] font-medium text-white/50">
              Paused{bufferedCount > 0 ? ` · ${bufferedCount} new` : ''}
            </span>
          </div>
        </div>
      )}
      {/* AI Image Popup */}
      {popup && popup.images.length > 0 && (
        <div
          ref={popupRef}
          className="fixed z-50 flex items-center gap-1 p-1.5 rounded-lg border border-emerald-500/30 bg-gray-900/95 backdrop-blur-sm shadow-xl"
          style={{
            left: popup.x,
            top: popup.y - 56,
            transform: 'translateX(-50%)',
          }}
        >
          {popup.images.slice(0, 6).map((img, idx) => (
            <button
              key={idx}
              onMouseUp={(e) => handlePopupImageClick(e, idx)}
              onClick={(e) => handlePopupImageClick(e, idx)}
              onMouseEnter={() => setPopup(p => p ? { ...p, selectedImage: idx } : null)}
              className={`w-10 h-10 rounded overflow-hidden border-2 transition-all flex-shrink-0 ${
                idx === popup.selectedImage
                  ? 'border-emerald-500 ring-1 ring-emerald-500/40 scale-110'
                  : 'border-gray-700/40 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={px(img)}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </button>
          ))}
          {popup.images.length > 6 && (
            <span className="text-[8px] text-white/30 ml-0.5">+{popup.images.length - 6}</span>
          )}
          <button
            onMouseUp={(e) => { e.stopPropagation(); setPopup(null); }}
            onClick={(e) => { e.stopPropagation(); setPopup(null); }}
            onMouseEnter={() => setPopup(p => p ? { ...p, selectedImage: -1 } : null)}
            className={`w-10 h-10 rounded overflow-hidden border-2 flex-shrink-0 flex items-center justify-center ${
              popup.selectedImage === -1
                ? 'border-red-500 ring-1 ring-red-500/40 scale-110 bg-red-500/20'
                : 'border-gray-700/40 bg-white/[0.04] opacity-60 hover:opacity-100'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-red-400">
              <line x1="3" y1="3" x2="11" y2="11" /><line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-1 space-y-px">
        {tweets.length === 0 ? (
          <div className="text-center py-16 text-white/25">
            <div className="w-6 h-6 border-2 border-white/[0.08] border-t-white/30 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium text-white/30">Loading tracker...</p>
          </div>
        ) : (
          tweets.map((tweet) => (
            <TweetCard
              key={tweet.id}
              tweet={tweet}
              tweetAi={aiResults?.[tweet.id]}
              deployBtnPosition={deployBtnPosition}
              deployBtnScale={deployBtnScale}
              onDeploy={stableOnDeploy}
              onFollowDeploy={stableOnFollowDeploy}
              onHighlightMouseDown={handleHighlightMouseDown}
            />
          ))
        )}
      </div>
      </div>{/* end scrollable content */}
    </div>
  );
}
