"use client";

import { useEffect, useRef, useState } from 'react';

interface BarkMessage {
  _id: string;
  source?: string;
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  image?: string;
  time: number;
  tags: {
    TYPE: string;
    SUBTYPE?: string;
    [key: string]: string | undefined;
  };
  show_feed?: boolean;
  show_notif?: boolean;
  info?: {
    twitterId?: string;
    isReply?: boolean;
    isSelfReply?: boolean;
    isRetweet?: boolean;
    isQuote?: boolean;
    quotedUser?: {
      screen_name?: string;
      name?: string;
      icon?: string;
      text?: string;
      image?: string;
      video?: string;
    };
    replyUser?: {
      screen_name?: string;
      name?: string;
      icon?: string;
      text?: string;
    };
    retweetedUser?: {
      screen_name?: string;
      name?: string;
      icon?: string;
      text?: string;
      image?: string;
    };
  };
}

interface UseBarkFeedOptions {
  onTweetReceived?: (tweet: any) => void;
  onInitialTweets?: (tweets: any[]) => void;
  onTweetDeleted?: (tweetId: string) => void;
  onFollow?: (data: any) => void;
  onUnfollow?: (data: any) => void;
  onProfileChange?: (data: any) => void;
  token: string;
}

export function useBarkFeed({
  onTweetReceived,
  onInitialTweets,
  onTweetDeleted,
  onFollow,
  onUnfollow,
  onProfileChange,
  token
}: UseBarkFeedOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Store callbacks in refs so they don't cause reconnections
  const onTweetReceivedRef = useRef(onTweetReceived);
  const onInitialTweetsRef = useRef(onInitialTweets);
  const onTweetDeletedRef = useRef(onTweetDeleted);
  const onFollowRef = useRef(onFollow);
  const onUnfollowRef = useRef(onUnfollow);
  const onProfileChangeRef = useRef(onProfileChange);

  // Update refs when callbacks change
  useEffect(() => {
    onTweetReceivedRef.current = onTweetReceived;
    onInitialTweetsRef.current = onInitialTweets;
    onTweetDeletedRef.current = onTweetDeleted;
    onFollowRef.current = onFollow;
    onUnfollowRef.current = onUnfollow;
    onProfileChangeRef.current = onProfileChange;
  }, [onTweetReceived, onInitialTweets, onTweetDeleted, onFollow, onUnfollow, onProfileChange]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const connect = () => {
      // Check if there's already a connection open or connecting
      if (wsRef.current) {
        const state = wsRef.current.readyState;
        if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
          return;
        }
      }

      try {
        const ws = new WebSocket('wss://news.bark.gg/ws');
        wsRef.current = ws;
      } catch (err) {
        console.error('[BarkFeed] ❌ Failed to create WebSocket:', err);
        setError('Failed to create WebSocket connection');
        return;
      }

      const ws = wsRef.current;

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // Send authentication - "login {token}" format
        const authMessage = `login ${token}`;
        ws.send(authMessage);
      };

      ws.onmessage = (event) => {
        const receiveTime = performance.now();
        try {
          const message: BarkMessage = JSON.parse(event.data);

          // Route message based on TYPE and SUBTYPE
          const { TYPE, SUBTYPE } = message.tags || {};
          const processStart = performance.now();

          if (TYPE === 'TWEET') {
            if (SUBTYPE === 'NEW_TWEET') {
              handleNewTweet(message);
            } else if (SUBTYPE === 'DELETED_TWEET') {
              handleDeletedTweet(message);
            }
          } else if (TYPE === 'PROFILE') {
            handleProfileEvent(message);
          } else if (TYPE === 'TRUTH_SOCIAL' && SUBTYPE === 'POST') {
            handleTruthSocialPost(message);
          }
        } catch (err) {
          console.error('[BarkFeed] ❌ Error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[BarkFeed] WebSocket error:', err);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        setIsConnected(false);

        // Attempt reconnection with exponential backoff
        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setError('Failed to reconnect after 5 attempts');
        }
      };
    };

    const handleNewTweet = (message: BarkMessage) => {
      const tags = message.tags;

      // Extract media
      const media: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
      if (tags.IMAGE) media.push({ type: 'image', url: tags.IMAGE });
      if (tags.IMAGE2) media.push({ type: 'image', url: tags.IMAGE2 });
      if (tags.IMAGE3) media.push({ type: 'image', url: tags.IMAGE3 });
      if (tags.VIDEO) media.push({ type: 'video', url: tags.VIDEO });

      // Get profile picture - try message.icon first (bark.gg likely uses this)
      const authorProfilePic = message.icon || tags.AUTHOR_ICON || '';

      // Build replied-to tweet if this is a reply
      // Bark.gg sends this in message.info.replyUser!
      let repliedToTweet;
      if (tags.IS_REPLY === 'true' || message.info?.isReply) {
        // Prefer message.info.replyUser over tags
        const replyUser = message.info?.replyUser;
        const replyHandle = replyUser?.screen_name || tags.REPLY_AUTHOR_HANDLE || tags.REPLY_HANDLE || tags.IN_REPLY_TO_SCREEN_NAME || 'unknown';
        const replyName = replyUser?.name || tags.REPLY_AUTHOR_NAME || tags.REPLY_NAME || tags.IN_REPLY_TO_NAME || replyHandle;
        const replyText = replyUser?.text || tags.REPLY_TWEET_TEXT || tags.REPLY_TEXT || tags.IN_REPLY_TO_TEXT || tags.IN_REPLY_TO_TWEET_TEXT || '';
        const replyPic = replyUser?.icon || tags.REPLY_AUTHOR_ICON || tags.REPLY_ICON || tags.IN_REPLY_TO_ICON || tags.IN_REPLY_TO_AUTHOR_ICON || '';
        const replyId = tags.REPLY_TWEET_ID || tags.REPLY_ID || tags.IN_REPLY_TO_STATUS_ID || tags.IN_REPLY_TO_ID || 'reply';

        // ALWAYS create repliedToTweet if IS_REPLY is true, even if we don't have all fields
        if (replyHandle !== 'unknown' || replyText) {
          repliedToTweet = {
            id: replyId,
            username: replyHandle,
            displayName: replyName,
            handle: `@${replyHandle}`,
            verified: tags.REPLY_VERIFIED === 'true' || tags.IN_REPLY_TO_VERIFIED === 'true',
            timestamp: new Date(message.time).toISOString(),
            text: replyText || '[No text available]',
            profilePic: replyPic,
            highlightColor: undefined,
          };
        }
      }

      // Build quoted tweet if this is a quote (has quoted content)
      // Bark.gg sends this in message.info.quotedUser!
      let quotedTweet;
      if (tags.IS_QUOTE === 'true' || message.info?.isQuote) {
        // Prefer message.info.quotedUser over tags
        const quotedUser = message.info?.quotedUser;
        const quotedHandle = quotedUser?.screen_name || tags.QUOTED_AUTHOR_HANDLE || tags.QUOTED_HANDLE || 'unknown';
        const quotedName = quotedUser?.name || tags.QUOTED_AUTHOR_NAME || tags.QUOTED_NAME || quotedHandle;
        const quotedText = quotedUser?.text || tags.QUOTED_TWEET_TEXT || tags.QUOTED_TEXT || message.body || 'No text content';
        const quotedPic = quotedUser?.icon || tags.QUOTED_AUTHOR_ICON || tags.QUOTED_ICON || '';

        // Extract media from info.quotedUser or QUOTED_IMAGE/QUOTED_VIDEO fields
        const quotedMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
        if (quotedUser?.image) quotedMedia.push({ type: 'image', url: quotedUser.image });
        if (quotedUser?.video) quotedMedia.push({ type: 'video', url: quotedUser.video });
        if (tags.QUOTED_IMAGE) quotedMedia.push({ type: 'image', url: tags.QUOTED_IMAGE });
        if (tags.QUOTED_VIDEO) quotedMedia.push({ type: 'video', url: tags.QUOTED_VIDEO });
        // Fallback: if quoted tweet has no media but message.image exists, use it
        if (quotedMedia.length === 0 && message.image) {
          quotedMedia.push({ type: 'image', url: message.image });
        }

        quotedTweet = {
          id: tags.QUOTED_TWEET_ID || tags.QUOTED_ID || 'quoted',
          username: quotedHandle,
          displayName: quotedName,
          handle: `@${quotedHandle}`,
          verified: tags.QUOTED_VERIFIED === 'true',
          timestamp: new Date(message.time).toISOString(),
          text: quotedText,
          profilePic: quotedPic,
          highlightColor: undefined,
          media: quotedMedia.length > 0 ? quotedMedia : undefined,
        };
      }

      // Build retweeted tweet if this is a PURE retweet (no added text)
      let retweetedContent;
      const isRetweet = tags.IS_RETWEET === 'true';

      if (isRetweet || message.info?.isRetweet) {
        // Prefer message.info.retweetedUser over tags
        const retweetUser = message.info?.retweetedUser;
        const retweetHandle = retweetUser?.screen_name || tags.RETWEET_AUTHOR_HANDLE || tags.RETWEET_HANDLE || 'unknown';
        const retweetName = retweetUser?.name || tags.RETWEET_AUTHOR_NAME || tags.RETWEET_NAME || retweetHandle;
        const retweetText = retweetUser?.text || tags.RETWEET_TWEET_TEXT || tags.RETWEET_TEXT || message.body || tags.TWEET_TEXT || '';
        const retweetPic = retweetUser?.icon || tags.RETWEET_AUTHOR_ICON || tags.RETWEET_ICON || '';

        // Extract media from info.retweetedUser or RETWEET_IMAGE/RETWEET_VIDEO fields
        const retweetMedia: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
        if (retweetUser?.image) retweetMedia.push({ type: 'image', url: retweetUser.image });
        if (tags.RETWEET_IMAGE) retweetMedia.push({ type: 'image', url: tags.RETWEET_IMAGE });
        if (tags.RETWEET_VIDEO) retweetMedia.push({ type: 'video', url: tags.RETWEET_VIDEO });
        // Fallback: if retweet has no specific media but main tags.IMAGE exists, use it
        if (retweetMedia.length === 0 && media.length > 0) {
          retweetMedia.push(...media);
        }

        retweetedContent = {
          id: tags.RETWEET_TWEET_ID || tags.RETWEET_ID || 'retweeted',
          username: retweetHandle,
          displayName: retweetName,
          handle: `@${retweetHandle}`,
          verified: tags.RETWEET_VERIFIED === 'true',
          timestamp: new Date(message.time).toISOString(),
          text: retweetText,
          profilePic: retweetPic,
          highlightColor: undefined,
          media: retweetMedia.length > 0 ? retweetMedia : undefined,
        };
      }

      // Extract link preview data (for Twitter-style URL cards)
      const linkPreviews: Array<{
        url: string;
        title?: string;
        description?: string;
        image?: string;
        domain?: string;
      }> = [];

      // Check for Bark-provided link metadata (specific LINK_* or CARD_* tags only)
      const barkLinkUrl = tags.LINK_URL || tags.URL_CARD || tags.CARD_URL;
      const barkLinkTitle = tags.LINK_TITLE || tags.URL_TITLE || tags.CARD_TITLE;
      const barkLinkDesc = tags.LINK_DESCRIPTION || tags.URL_DESCRIPTION || tags.CARD_DESCRIPTION;
      const barkLinkImage = tags.LINK_IMAGE || tags.URL_IMAGE || tags.CARD_IMAGE;

      if (barkLinkUrl && barkLinkUrl.startsWith('http')) {
        let domain = '';
        try { domain = new URL(barkLinkUrl).hostname.replace('www.', ''); } catch {}
        linkPreviews.push({
          url: barkLinkUrl,
          title: barkLinkTitle,
          description: barkLinkDesc,
          image: barkLinkImage,
          domain,
        });
      }

      // Also extract URLs from tweet text for link cards
      if (linkPreviews.length === 0) {
        const tweetText = tags.TWEET_TEXT || '';
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
        const foundUrls = tweetText.match(urlRegex) || [];

        // Filter out twitter/x.com URLs (tweet references, not link previews)
        const externalUrls = foundUrls.filter((url: string) => {
          try {
            const hostname = new URL(url).hostname.replace('www.', '');
            return !['twitter.com', 'x.com', 't.co'].includes(hostname);
          } catch { return false; }
        });

        for (const url of externalUrls) {
          let domain = '';
          try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
          linkPreviews.push({ url, domain });
        }
      }

      const tweet = {
        id: `bark-${tags.TWEET_ID || message._id}`,
        twitterStatusId: tags.TWEET_ID,
        username: tags.AUTHOR_HANDLE || 'unknown',
        displayName: tags.AUTHOR_NAME || tags.AUTHOR_HANDLE || 'Unknown',
        handle: `@${tags.AUTHOR_HANDLE || 'unknown'}`,
        verified: tags.AUTHOR_VERIFIED === 'true' || tags.VERIFIED === 'true',
        timestamp: new Date(message.time).toISOString(),
        text: tags.TWEET_TEXT || tags.TWEET_TEXT_TRANSLATED || '',
        profilePic: authorProfilePic,
        isRetweet: isRetweet,
        isReply: tags.IS_REPLY === 'true',
        isQuote: tags.IS_QUOTE === 'true',
        media: isRetweet ? undefined : (media.length > 0 ? media : undefined),
        repliedToTweet,
        quotedTweet: retweetedContent || quotedTweet,
        originalAuthorHandle: isRetweet && tags.RETWEET_AUTHOR_HANDLE ? `@${tags.RETWEET_AUTHOR_HANDLE}` : undefined,
        linkPreviews: linkPreviews.length > 0 ? linkPreviews : undefined,
        contractAddress: tags.CONTRACT_ADDRESS,
        chain: tags.CHAIN,
        tradingUrl: tags.PREFERRED_TRADING_URL,
        label: tags.LABEL,
        category: tags.CATEGORY,
      };

      if (onTweetReceivedRef.current) {
        onTweetReceivedRef.current(tweet);
      }
    };

    const handleDeletedTweet = (message: BarkMessage) => {
      const tags = message.tags;

      // Create a notification tweet for the deletion
      const deletionNotification = {
        id: `bark-deleted-${tags.DELETED_TWEET_ID || message._id}`,
        twitterStatusId: tags.DELETED_TWEET_ID,
        username: tags.AUTHOR_HANDLE || 'unknown',
        displayName: tags.AUTHOR_NAME || 'Unknown',
        handle: `@${tags.AUTHOR_HANDLE || 'unknown'}`,
        verified: false,
        timestamp: new Date(message.time).toISOString(),
        text: `🗑️ DELETED TWEET:\n${tags.DELETED_CONTENT || tags.TWEET_TEXT || 'No content available'}`,
        profilePic: tags.AUTHOR_ICON || '',
        highlightColor: '#ef4444', // Red for deleted
        tweetType: 'DELETED',
        contractAddress: tags.CONTRACT_ADDRESS,
        chain: tags.CHAIN,
        isReply: tags.IS_REPLY === 'true',
        isQuote: tags.IS_QUOTE === 'true',
        isRetweet: tags.IS_RETWEET === 'true',
      };

      if (onTweetReceivedRef.current) {
        onTweetReceivedRef.current(deletionNotification);
      }

      // Also trigger deletion callback
      if (onTweetDeletedRef.current && tags.DELETED_TWEET_ID) {
        onTweetDeletedRef.current(tags.DELETED_TWEET_ID);
      }
    };

    const handleProfileEvent = (message: BarkMessage) => {
      const tags = message.tags;
      const { SUBTYPE } = tags;

      // Convert all profile events to tweet-like objects for display
      const username = tags.AUTHOR_HANDLE || 'unknown';
      const displayName = tags.AUTHOR_NAME || username;
      const profilePic = tags.AUTHOR_ICON || '';

      let eventText = '';
      let highlightColor = '#3b82f6'; // Blue for profile changes
      let tweetType = SUBTYPE;

      if (SUBTYPE === 'FOLLOW') {
        eventText = `followed @${tags.FOLLOWED_HANDLE || 'unknown'}`;
        highlightColor = '#10b981'; // Green
      } else if (SUBTYPE === 'UNFOLLOW') {
        eventText = `unfollowed @${tags.FOLLOWED_HANDLE || 'unknown'}`;
        highlightColor = '#ef4444'; // Red
      } else if (SUBTYPE === 'BIO_CHANGE') {
        eventText = `📝 Changed bio:\n\nOld: ${tags.OLD_BIO || tags.OLD_BIO_TRANSLATED || 'None'}\n\nNew: ${tags.NEW_BIO || tags.NEW_BIO_TRANSLATED || 'None'}`;
        highlightColor = '#3b82f6'; // Blue
      } else if (SUBTYPE === 'NAME_CHANGE') {
        eventText = `📝 Changed name: "${tags.OLD_NAME || 'Old Name'}" → "${tags.NEW_NAME || 'New Name'}"`;
        highlightColor = '#3b82f6'; // Blue
      } else if (SUBTYPE === 'PROFILE_PICTURE_CHANGE') {
        eventText = `🖼️ Changed profile picture`;
        highlightColor = '#3b82f6'; // Blue
      } else if (SUBTYPE === 'LOCATION_CHANGE') {
        eventText = `📍 Changed location:\n${tags.OLD_LOCATION || 'None'} → ${tags.NEW_LOCATION || 'None'}`;
        highlightColor = '#3b82f6'; // Blue
      } else if (SUBTYPE === 'PINNED_TWEET') {
        eventText = `📌 Pinned a tweet:\n\n${tags.TWEET_TEXT || 'No text'}`;
        highlightColor = '#f59e0b'; // Amber
      } else if (SUBTYPE === 'UNPINNED_TWEET') {
        eventText = `📌 Unpinned a tweet:\n\n${tags.TWEET_TEXT || 'No text'}`;
        highlightColor = '#6b7280'; // Gray
      } else if (SUBTYPE === 'PINNED_CHANGE') {
        eventText = `📌 Changed pinned tweet:`;
        if (tags.OLD_TWEET_TEXT) {
          eventText += `\n\nOld: ${tags.OLD_TWEET_TEXT}`;
        }
        if (tags.NEW_TWEET_TEXT) {
          eventText += `\n\nNew: ${tags.NEW_TWEET_TEXT}`;
        }
        highlightColor = '#f59e0b'; // Amber
      } else if (SUBTYPE === 'BANNER_CHANGE') {
        eventText = `🖼️ Changed banner image`;
        highlightColor = '#3b82f6'; // Blue
      } else {
        eventText = `Profile event: ${SUBTYPE}`;
        highlightColor = '#6b7280'; // Gray
      }

      // Build followedUser data for FOLLOW/UNFOLLOW events
      const followedUser = (SUBTYPE === 'FOLLOW' || SUBTYPE === 'UNFOLLOW') ? {
        handle: tags.FOLLOWED_HANDLE || 'unknown',
        displayName: tags.FOLLOWED_NAME || tags.FOLLOWED_HANDLE || 'Unknown',
        profilePic: tags.FOLLOWED_ICON || '',
        bio: tags.FOLLOWED_BIO || tags.FOLLOWED_BIO_TRANSLATED || undefined,
        followers: tags.FOLLOWED_FOLLOWERS || undefined,
        url: tags.FOLLOWED_URL || undefined,
      } : undefined;

      // Create tweet-like object for display
      const eventTweet = {
        id: `bark-profile-${SUBTYPE}-${username}-${Date.now()}`,
        username,
        displayName,
        handle: `@${username}`,
        verified: false,
        timestamp: new Date(message.time).toISOString(),
        text: eventText,
        profilePic,
        highlightColor,
        tweetType,
        followedUser,
        contractAddress: tags.CONTRACT_ADDRESS,
        chain: tags.CHAIN,
        // Add image if available (for banner/picture changes)
        imageUrl: tags.NEW_PROFILE_PICTURE || tags.NEW_BANNER || tags.NEW_IMAGE || message.image,
      };

      if (onTweetReceivedRef.current) {
        onTweetReceivedRef.current(eventTweet);
      }

      // Trigger profile change callback (follow/unfollow already handled via onTweetReceived above)
      if (SUBTYPE !== 'FOLLOW' && SUBTYPE !== 'UNFOLLOW' && onProfileChangeRef.current) {
        onProfileChangeRef.current({
          type: SUBTYPE,
          author: { handle: tags.AUTHOR_HANDLE, name: tags.AUTHOR_NAME, id: tags.AUTHOR_ID, icon: tags.AUTHOR_ICON },
          changes: tags,
          message,
        });
      }
    };

    const handleTruthSocialPost = (message: BarkMessage) => {
      const tags = message.tags;

      const media: Array<{ type: 'image' | 'video' | 'gif'; url: string }> = [];
      if (tags.IMAGE) media.push({ type: 'image', url: tags.IMAGE });
      if (tags.VIDEO) media.push({ type: 'video', url: tags.VIDEO });

      const post = {
        id: `bark-truth-${tags.POST_ID || message._id}`,
        twitterStatusId: tags.POST_ID,
        username: tags.AUTHOR_USERNAME || 'unknown',
        displayName: tags.AUTHOR_DISPLAY_NAME || tags.AUTHOR_USERNAME || 'Unknown',
        handle: `@${tags.AUTHOR_USERNAME || 'unknown'}`,
        verified: false,
        timestamp: new Date(message.time).toISOString(),
        text: tags.POST_TEXT || '',
        profilePic: tags.AUTHOR_ICON || '',
        platform: 'truthsocial' as const,
        media: media.length > 0 ? media : undefined,
        tweetUrl: tags.POST_URL,
        highlightColor: '#FF0000', // Red for Truth Social
      };

      if (onTweetReceivedRef.current) {
        onTweetReceivedRef.current(post);
      }
    };

    connect();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]); // Only reconnect when token changes, not when callbacks change

  return { isConnected, error };
}
