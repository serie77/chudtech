"use client";

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface J7Tweet {
  id?: string;
  createdAt?: number;
  author?: {
    id?: string;
    handle?: string;
    name?: string;
    avatar?: string;
    verified?: boolean;
  };
  originalAuthor?: {
    id?: string;
    handle?: string;
    name?: string;
    avatar?: string;
    verified?: boolean;
  };
  text?: string;
  type?: string;
  isRetweet?: boolean;
  media?: {
    images?: Array<{ url: string }>;
    videos?: any[];
  };
  originalMedia?: {
    images?: Array<{ url: string }>;
    videos?: any[];
  };
  tweetUrl?: string;
}

interface UseJ7FeedOptions {
  onTweetReceived?: (tweet: J7Tweet) => void;
  onInitialTweets?: (tweets: J7Tweet[]) => void;
  onTweetDeleted?: (tweetId: string) => void;
  onFollow?: (data: any) => void;
  onUnfollow?: (data: any) => void;
  onDeactivation?: (data: any) => void;
  jwtToken: string;
}

export function useJ7Feed({ onTweetReceived, onInitialTweets, onTweetDeleted, onFollow, onUnfollow, onDeactivation, jwtToken }: UseJ7FeedOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jwtToken) {
      return;
    }

    // Create Socket.IO client with proper configuration
    const socket = io('wss://j7tracker.com', {
      transports: ['websocket'], // Use WebSocket only
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      // Socket.IO client automatically handles large payloads via chunking
    });

    socketRef.current = socket;

    // Connection established
    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);

      // Send authentication
      socket.emit('user_connected', jwtToken);
    });

    // Connection error
    socket.on('connect_error', (err) => {
      console.error('[J7Feed] Connection error:', err.message);
      setError(err.message);
      setIsConnected(false);
    });

    // Disconnection
    socket.on('disconnect', (reason) => {
      setIsConnected(false);

      if (reason === 'io server disconnect') {
        // Server disconnected us, need to reconnect manually
        socket.connect();
      }
    });

    // Reconnection failed
    socket.on('reconnect_failed', () => {
      console.error('[J7Feed] Reconnection failed after all attempts');
      setError('Failed to reconnect to J7Tracker');
    });

    // Listen for tweet events
    socket.on('tweet', (data: J7Tweet) => {
      if (onTweetReceived) {
        onTweetReceived(data);
      }
    });

    // Listen for follow events
    socket.on('follow', (data: any) => {
      if (onFollow) onFollow(data);
    });

    // Listen for unfollow events
    socket.on('unfollow', (data: any) => {
      if (onUnfollow) onUnfollow(data);
    });

    // Listen for tweet deletion events
    socket.on('tweet_delete', (data: any) => {
      if (onTweetDeleted) onTweetDeleted(data.id || data.tweetId || data);
    });

    // Listen for account deactivation events
    socket.on('deactivation', (data: any) => {
      if (onDeactivation) onDeactivation(data);
    });

    // Listen for initial tweets (batch)
    socket.on('initialTweets', (data: J7Tweet[]) => {
      const tweets = Array.isArray(data) ? data : [];
      if (onInitialTweets) {
        onInitialTweets(tweets);
      }
    });

    // Listen for tweet updates
    socket.on('tweet_update', (_data: J7Tweet) => {
      // You can add update logic here if needed
    });

    // Listen for quoted tweets
    socket.on('quoted_tweet', (data: J7Tweet) => {
      if (onTweetReceived) {
        onTweetReceived(data);
      }
    });

    // Listen for external messages (Discord, etc.)
    socket.on('external_message', (_data: any) => {
    });

    // Generic error handler
    socket.on('error', (err: any) => {
      console.error('[J7Feed] Socket error:', err);
      setError(err?.message || 'Unknown socket error');
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [jwtToken, onTweetReceived, onInitialTweets, onTweetDeleted, onFollow, onUnfollow, onDeactivation]);

  return { isConnected, error };
}
