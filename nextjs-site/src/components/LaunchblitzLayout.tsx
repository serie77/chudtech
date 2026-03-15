"use client";

import { useState, useCallback, Fragment } from "react";
import { Search, UserPen, Settings as SettingsIcon, ChevronRight, Clock, Users, Settings2, Hash, User, LogOut, X, Link2, ExternalLink, Pin } from "lucide-react";
import { Panel as ResizablePanel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { storeGet, storeSet } from "@/lib/store";

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
  platform?: 'twitter' | 'truthsocial' | 'x';
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

interface LaunchblitzLayoutProps {
  tweets: Tweet[];
  isConnected: boolean;
  onlineCount: number;
  onOpenSettings: () => void;
  onOpenDeploySettings: () => void;
  onParseTweetUrl: (url: string) => void;
  onLaunchTweet: (tweet: Tweet) => void;
  renderDeployPanel: () => React.ReactNode;
  renderTokenSearch: () => React.ReactNode;
  feedPaused?: boolean;
  onHoverChange?: (hovered: boolean) => void;
  bufferedCount?: number;
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  } catch {
    return ts;
  }
}

function TweetTypeLabel({ tweet }: { tweet: Tweet }) {
  if (tweet.tweetType === 'follow' || tweet.followedUser) {
    return <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Followed</span>;
  }
  if (tweet.isReply) return <span className="text-[10px] font-medium text-blue-400/70">Reply</span>;
  if (tweet.isQuote) return <span className="text-[10px] font-medium text-purple-400/70">Quote</span>;
  if (tweet.isRetweet) return <span className="text-[10px] font-medium text-emerald-400/70">Retweet</span>;
  return null;
}

function FeedTweetCard({ tweet, onLaunch, isExpanded, onToggleExpand }: { tweet: Tweet; onLaunch: (t: Tweet) => void; isExpanded: boolean; onToggleExpand: () => void }) {
  const proxyImg = (url: string) => `/api/proxy-image?url=${encodeURIComponent(url)}`;
  const tweetUrl = tweet.twitterStatusId
    ? `https://x.com/${tweet.username}/status/${tweet.twitterStatusId.replace(/^[a-zA-Z-]+/, '')}`
    : `https://x.com/${tweet.username}`;

  const isPinned = tweet.tweetType === 'follow' || tweet.followedUser;

  // Follow event card — same structure as regular tweets
  if (tweet.tweetType === 'follow' && tweet.followedUser) {
    return (
      <div
        style={tweet.highlightColor ? {
          background: `${tweet.highlightColor}10`,
          boxShadow: `inset 3px 0 0 ${tweet.highlightColor}90`,
        } : undefined}
      >
        {/* Header bar */}
        <div className="flex items-stretch border-y border-white/[0.08]">
          <div className="min-w-0 flex-1 overflow-hidden px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-white/[0.015] transition-colors" onClick={onToggleExpand}>
            <img src={proxyImg(tweet.profilePic)} alt="" className="w-9 h-9 shrink-0 rounded-full object-cover" loading="eager" />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="truncate font-medium leading-none text-[13px] text-white">{tweet.displayName}</span>
                {tweet.verified && (
                  <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
                )}
                <span className="text-sm text-white/30">{formatTimestamp(tweet.timestamp)}</span>
                <span className="text-[11px] text-green-400 font-semibold uppercase tracking-wider">Followed</span>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-white/40 min-w-0">
                <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 hover:underline truncate">@{tweet.username}</a>
                <span className="text-white/20">•</span>
                <Users className="w-3 h-3" />
                <span>{tweet.followedUser?.followers || '0'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-stretch border-l border-white/[0.08] shrink-0">
            <div className="flex items-center px-3 hover:bg-white/[0.03] transition-colors">
              <button className="text-white/30 hover:text-white/60 transition-colors" title="Past coins" onClick={e => e.stopPropagation()}>
                <Clock className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={() => onLaunch(tweet)}
              className="flex items-center justify-center gap-1 border-l border-white/[0.08] w-[140px] text-sm font-medium text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
            >
              Launch <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expanded: followed user profile */}
        {isExpanded && (
          <>
            <div className="px-5 py-3">
              <div className="text-sm text-white/60 mb-2">
                <a href={`https://x.com/${tweet.username}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@{tweet.username}</a>
                {' '}followed{' '}
                <a href={`https://x.com/${tweet.followedUser!.handle}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@{tweet.followedUser!.handle}</a>
              </div>
              {tweet.followedUser!.profilePic && (
                <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <div className="flex items-start gap-3 p-3">
                    <img src={proxyImg(tweet.followedUser!.profilePic)} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" loading="eager" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">{tweet.followedUser!.displayName}</span>
                      </div>
                      <span className="text-xs text-blue-400/70">@{tweet.followedUser!.handle}</span>
                      {tweet.followedUser!.bio && (
                        <p className="text-xs text-white/50 mt-1 line-clamp-2">{tweet.followedUser!.bio}</p>
                      )}
                      {tweet.followedUser!.followers && (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                          <span><Users className="inline w-3 h-3 mr-0.5" />{tweet.followedUser!.followers} Followers</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="flex items-stretch justify-between h-8 border-t border-white/[0.08]">
              <div className="flex items-stretch">
                <button onClick={onToggleExpand} className="flex items-center justify-center w-[52px] border-r border-white/[0.08] text-white/30 hover:bg-red-900/30 hover:text-red-400 transition-colors" title="Collapse">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={() => { navigator.clipboard.writeText(tweetUrl); }} className="flex items-center justify-center w-[52px] border-r border-white/[0.08] text-white/30 hover:bg-white/[0.03] hover:text-white/60 transition-colors" title="Copy link">
                  <Link2 className="w-4 h-4" />
                </button>
              </div>
              <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center border-l border-white/[0.08] w-[80px] text-xs font-medium text-white/50 gap-1.5 hover:bg-white/[0.03] hover:text-white/80 transition-colors">
                View <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}

        <div className="h-[5px] bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <div
      style={tweet.highlightColor ? {
        background: `${tweet.highlightColor}10`,
        boxShadow: `inset 3px 0 0 ${tweet.highlightColor}90`,
      } : undefined}
    >
      {/* Header bar — full-width, Launch button in border-l section */}
      <div className="flex items-stretch border-y border-white/[0.08]">
        {/* Left: profile + info — clickable to expand */}
        <div
          className="min-w-0 flex-1 overflow-hidden px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-white/[0.015] transition-colors"
          onClick={onToggleExpand}
        >
          <img
            src={proxyImg(tweet.profilePic)}
            alt=""
            className="w-9 h-9 shrink-0 rounded-full object-cover"
            loading="eager"
          />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="truncate font-medium leading-none text-[13px] text-white">{tweet.displayName}</span>
              {tweet.verified && (
                <svg className="w-3 h-3 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
              )}
              <span className="text-sm text-white/30">{formatTimestamp(tweet.timestamp)}</span>
              {tweet.isReply && <span className="flex items-center gap-1 text-[11px] text-sky-400"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>Reply</span>}
              {tweet.isQuote && <span className="text-[11px] text-purple-400">Quote</span>}
              {tweet.isRetweet && <span className="flex items-center gap-1 text-[11px] text-emerald-400"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>Retweet</span>}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-white/40 min-w-0">
              <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 hover:underline truncate">@{tweet.username}</a>
              <span className="text-white/20">•</span>
              <Users className="w-3 h-3" />
              <span>{tweet.username}</span>
            </div>
          </div>
        </div>

        {/* Right: History + Launch — separated by border-l */}
        <div className="flex items-stretch border-l border-white/[0.08] shrink-0">
          <div className="flex items-center px-3 hover:bg-white/[0.03] transition-colors">
            <button className="text-white/30 hover:text-white/60 transition-colors" title="Past coins" onClick={e => e.stopPropagation()}>
              <Clock className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => onLaunch(tweet)}
            className="flex items-center justify-center gap-1 border-l border-white/[0.08] w-[140px] text-sm font-medium text-white hover:bg-white/[0.03] transition-colors cursor-pointer"
          >
            Launch <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tweet content — ALWAYS visible */}
      {(tweet.text || (tweet.media && tweet.media.length > 0) || tweet.imageUrl || (tweet.linkPreviews && tweet.linkPreviews.length > 0) || tweet.repliedToTweet || tweet.quotedTweet) && (
        <div className="px-5 pt-3 pb-1">
          {tweet.text && (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-white/85">{tweet.text}</p>
          )}

          {/* Media */}
          {tweet.media && tweet.media.length > 0 && (
            <div className={`mt-3 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.03] p-3 ${tweet.media.length > 1 ? 'grid grid-cols-2 gap-0.5' : 'flex justify-center'}`}>
              {tweet.media.map((m, i) => (
                m.type === 'video' ? (
                  <video key={i} src={proxyImg(m.url)} poster={m.thumbnail ? proxyImg(m.thumbnail) : undefined} controls className="max-w-[400px] w-full max-h-[300px] rounded-lg object-contain" preload="metadata" />
                ) : (
                  <img key={i} src={proxyImg(m.url)} alt="" className="max-w-[400px] w-full max-h-[300px] rounded-lg object-contain" loading="eager" />
                )
              ))}
            </div>
          )}

          {/* Single image fallback */}
          {!tweet.media?.length && tweet.imageUrl && (
            <div className="mt-3 rounded-lg overflow-hidden border border-white/[0.08] bg-white/[0.03] p-3 flex justify-center">
              <img src={proxyImg(tweet.imageUrl)} alt="" className="max-w-[400px] w-full max-h-[300px] rounded-lg object-contain" loading="eager" />
            </div>
          )}

          {/* Link previews */}
          {tweet.linkPreviews && tweet.linkPreviews.length > 0 && (
            <div className="mt-3 space-y-2">
              {tweet.linkPreviews.map((lp, i) => (
                <a key={i} href={lp.url} target="_blank" rel="noopener noreferrer"
                  className="block rounded-lg border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:bg-white/[0.05] transition-colors">
                  {lp.image && (
                    <img src={proxyImg(lp.image)} alt="" className="w-full max-h-[200px] object-cover" loading="eager" />
                  )}
                  <div className="p-3">
                    {lp.domain && <p className="text-[10px] text-white/30 mb-0.5">{lp.domain}</p>}
                    {lp.title && <p className="text-sm font-medium text-white/80 line-clamp-2">{lp.title}</p>}
                    {lp.description && <p className="text-xs text-white/40 mt-1 line-clamp-2">{lp.description}</p>}
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Replied-to tweet — inline with left border */}
          {tweet.repliedToTweet && (
            <div className="mt-3 pl-3 border-l-2 border-blue-500/30">
              <div className="text-sm flex items-center gap-1 text-white/40 mb-1">
                <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Replying <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2 mb-1">
                {tweet.repliedToTweet.profilePic && (
                  <img src={proxyImg(tweet.repliedToTweet.profilePic)} alt="" className="w-7 h-7 rounded-full" loading="eager" />
                )}
                <span className="text-sm font-medium text-white/70">{tweet.repliedToTweet.displayName}</span>
                {tweet.repliedToTweet.verified && (
                  <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
                )}
                <span className="text-sm text-white/30">@{tweet.repliedToTweet.username}</span>
              </div>
              {tweet.repliedToTweet.text && (
                <p className="text-sm text-white/50 whitespace-pre-wrap">{tweet.repliedToTweet.text}</p>
              )}
            </div>
          )}

          {/* Quoted tweet */}
          {tweet.quotedTweet && (
            <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                {tweet.quotedTweet.profilePic && (
                  <img src={proxyImg(tweet.quotedTweet.profilePic)} alt="" className="w-7 h-7 rounded-full" loading="eager" />
                )}
                <span className="text-sm font-medium text-white/70">{tweet.quotedTweet.displayName}</span>
                {tweet.quotedTweet.verified && (
                  <svg className="w-3.5 h-3.5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></svg>
                )}
                <span className="text-sm text-white/30">@{tweet.quotedTweet.username}</span>
              </div>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{tweet.quotedTweet.text}</p>
              {tweet.quotedTweet.media && tweet.quotedTweet.media.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden flex justify-center">
                  {tweet.quotedTweet.media.map((m, i) => (
                    m.type === 'video' ? (
                      <video key={i} src={proxyImg(m.url)} poster={m.thumbnail ? proxyImg(m.thumbnail) : undefined} controls className="max-w-[400px] w-full max-h-[250px] rounded-lg object-contain" preload="metadata" />
                    ) : (
                      <img key={i} src={proxyImg(m.url)} alt="" className="max-w-[400px] w-full max-h-[250px] rounded-lg object-contain" loading="eager" />
                    )
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom action bar — shown on expand */}
      {isExpanded && (
        <div className="flex items-stretch justify-between h-8 border-t border-white/[0.08]">
          <div className="flex items-stretch">
            <button
              onClick={onToggleExpand}
              className="flex items-center justify-center w-[52px] border-r border-white/[0.08] text-white/30 hover:bg-red-900/30 hover:text-red-400 transition-colors"
              title="Collapse"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(tweetUrl); }}
              className="flex items-center justify-center w-[52px] border-r border-white/[0.08] text-white/30 hover:bg-white/[0.03] hover:text-white/60 transition-colors"
              title="Copy link"
            >
              <Link2 className="w-4 h-4" />
            </button>
          </div>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center border-l border-white/[0.08] w-[80px] text-xs font-medium text-white/50 gap-1.5 hover:bg-white/[0.03] hover:text-white/80 transition-colors"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Thick divider between tweets */}
      <div className="h-[5px] bg-white/[0.03]" />
    </div>
  );
}

// Buy amount presets from deploy settings
const BUY_AMOUNTS = [1, 3, 5];

// Platform icons
const PLATFORMS = [
  { id: 'pump', icon: '/images/pump-green.svg', fallback: 'P', label: 'Pump' },
];

export default function LaunchblitzLayout({
  tweets,
  isConnected,
  onlineCount,
  onOpenSettings,
  onOpenDeploySettings,
  onParseTweetUrl,
  onLaunchTweet,
  renderDeployPanel,
  renderTokenSearch,
  feedPaused = false,
  onHoverChange,
  bufferedCount = 0,
}: LaunchblitzLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab] = useState<'feed'>('feed');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [expandedTweetId, setExpandedTweetId] = useState<string | null>(null);

  // Buy amount from settings
  const [buyAmount, setBuyAmount] = useState(() => {
    if (typeof window !== 'undefined') return parseFloat(storeGet('nnn-buy-amount') || '1');
    return 1;
  });

  const filteredTweets = searchQuery.trim()
    ? tweets.filter(t =>
        t.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tweets;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-[#0a0a0b] text-white font-sans">
      {/* Top navbar */}
      <div className="sticky top-0 z-10 border-b border-white/[0.08]">
        <div className="px-3 py-2 bg-[#0a0a0a]">
          <div className="flex flex-nowrap items-center gap-2">
            {/* Logo + Nav tabs */}
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <a className="shrink-0" href="#">
                <div className="relative h-7 w-7">
                  <img src="/images/chud.jpg" alt="" className="h-7 w-7 rounded-md object-cover" />
                </div>
              </a>
              <div className="h-5 w-px bg-white/10 mx-1" />
              <div className="relative flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <button className="px-3 py-1.5 text-sm font-medium text-white">Feed</button>
                <button onClick={onOpenDeploySettings} className="px-3 py-1.5 text-sm font-medium text-white/40 hover:text-white/70">Wallets</button>
                <button onClick={onOpenSettings} className="px-3 py-1.5 text-sm font-medium text-white/40 hover:text-white/70">Settings</button>
                {/* Active tab indicator */}
                <span className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-white transition-all duration-200" style={{ width: 34, transform: 'translateX(12px)' }} />
              </div>
            </div>

            {/* Right side — quick settings + buy amounts + profile */}
            <div className="flex shrink-0 items-center gap-1.5">
              {/* Quick settings */}
              <button
                onClick={onOpenDeploySettings}
                className="inline-flex items-center justify-center h-8 w-8 text-white/40 hover:text-white transition-colors"
                title="Quick settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <div className="overflow-hidden whitespace-nowrap ml-1">
                <div className="flex items-center gap-1.5">
                  {/* Platform icon */}
                  <button className="inline-flex items-center justify-center h-8 w-8 p-0 text-white/60 hover:text-white" title="Cycle platform">
                    <img src="/images/pump-green.svg" alt="Pump" className="h-6 w-6" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </button>
                  {/* Buy amount buttons */}
                  <div className="relative flex items-center">
                    {BUY_AMOUNTS.map(amt => (
                      <button
                        key={amt}
                        onClick={() => { setBuyAmount(amt); storeSet('nnn-buy-amount', String(amt)); }}
                        className={`relative h-7 px-3 text-sm font-medium transition-colors ${
                          buyAmount === amt ? 'text-white' : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        {amt}
                        {buyAmount === amt && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-white" />
                        )}
                      </button>
                    ))}
                    <button className="relative h-7 px-3 text-sm font-medium text-white/40 hover:text-white/70" title="Custom buy amount">
                      <Hash className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-5 w-px bg-white/10 mx-1" />

              {/* Connection indicator */}
              <span className={`w-2 h-2 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Connected' : 'Disconnected'} />

              <div className="h-5 w-px bg-white/10 mx-1" />

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-zinc-900/50 h-9 w-9 hover:bg-white/10 hover:border-white/20 transition-all"
                  title="Profile"
                >
                  <User className="h-5 w-5 text-white" />
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-white/10 bg-[#111] shadow-xl py-1">
                      <button onClick={onOpenSettings} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white">
                        <SettingsIcon className="w-4 h-4" /> Settings
                      </button>
                      <button onClick={onOpenDeploySettings} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white">
                        <Settings2 className="w-4 h-4" /> Deploy Settings
                      </button>
                      <div className="h-px bg-white/[0.06] my-1" />
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            localStorage.removeItem('chud-api-key');
                            window.location.reload();
                          }
                        }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <LogOut className="w-4 h-4" /> Log out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content — 3 resizable panels: Deploy | Feed | Token Search */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <PanelGroup id="lb-panels" orientation="horizontal" className="h-full w-full">
          {/* LEFT: Deploy panel */}
          <ResizablePanel id="lb-deploy" defaultSize={34} minSize={15}>
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {renderDeployPanel()}
            </div>
          </ResizablePanel>

          <PanelResizeHandle className="splitter-v" />

          {/* CENTER: Feed */}
          <ResizablePanel id="lb-feed" defaultSize={43} minSize={20}>
            <div className="h-full flex flex-col border-x border-white/[0.06]">
              {/* Search bar */}
              <div className="flex items-center h-[52px] shrink-0 px-4 justify-between border-b border-white/[0.06]">
                <div className="flex flex-1 items-center gap-3">
                  <Search className="h-4 w-4 text-white/30 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search feed"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm focus:outline-none text-white/80 placeholder:text-white/25"
                  />
                </div>
                <div className="flex items-center gap-3 text-white/30">
                  <button className="hover:text-white/60 transition-colors" title="Edit watchlist">
                    <UserPen className="h-4 w-4" />
                  </button>
                  <button className="hover:text-white/60 transition-colors" title="Feed settings" onClick={onOpenSettings}>
                    <SettingsIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Tweet feed */}
              <div
                className="flex-1 overflow-y-auto overflow-x-hidden relative"
                onMouseEnter={() => onHoverChange?.(true)}
                onMouseLeave={() => onHoverChange?.(false)}
              >
                {/* Pause indicator */}
                {feedPaused && (
                  <div className="sticky top-2 left-0 right-0 z-40 flex justify-center pointer-events-none">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-white/[0.08] backdrop-blur-sm">
                      <div className="flex gap-[3px]">
                        <div className="w-[3px] h-[10px] rounded-sm bg-white/50" />
                        <div className="w-[3px] h-[10px] rounded-sm bg-white/50" />
                      </div>
                      <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
                        Paused{bufferedCount > 0 ? ` · ${bufferedCount} new` : ''}
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col">
                  {filteredTweets.map(tweet => (
                    <FeedTweetCard
                      key={tweet.id}
                      tweet={tweet}
                      onLaunch={onLaunchTweet}
                      isExpanded={expandedTweetId === tweet.id}
                      onToggleExpand={() => setExpandedTweetId(prev => prev === tweet.id ? null : tweet.id)}
                    />
                  ))}
                </div>
                {filteredTweets.length === 0 && (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm py-20">
                    {searchQuery ? 'No matching tweets' : 'Waiting for tweets...'}
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <PanelResizeHandle className="splitter-v" />

          {/* RIGHT: Token search */}
          <ResizablePanel id="lb-search" defaultSize={23} minSize={12}>
            <div className="h-full overflow-y-auto overflow-x-hidden">
              {renderTokenSearch()}
            </div>
          </ResizablePanel>
        </PanelGroup>
      </div>
    </div>
  );
}
