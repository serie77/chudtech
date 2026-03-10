// j7-socket-mirror.js
// Connects to j7tracker's WebSocket and mirrors the live feed

class J7SocketMirror {
  constructor(jwtToken) {
    this.jwt = jwtToken;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.pingInterval = null;
  }

  connect() {
    const wsUrl = 'wss://j7tracker.com/socket.io/?EIO=4&transport=websocket';
    console.log('[J7Mirror] Connecting...');
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[J7Mirror] Connected, waiting for server handshake...');
    };

    this.ws.onmessage = (event) => {
      const msg = event.data;
      
      // Socket.IO protocol handling
      if (msg.startsWith('0{')) {
        // Server handshake - respond with client handshake
        console.log('[J7Mirror] Server handshake received');
        this.ws.send('40');
      }
      else if (msg === '40' || msg.startsWith('40{')) {
        // Connection confirmed - send auth
        console.log('[J7Mirror] Sending auth...');
        this.ws.send(`42["user_connected","${this.jwt}"]`);
        this.startPing();
      }
      else if (msg === '2') {
        // Ping from server - respond with pong
        this.ws.send('3');
      }
      else if (msg.startsWith('42')) {
        // Data message - parse and handle
        try {
          const json = JSON.parse(msg.slice(2));
          const [eventType, data] = json;
          this.handleEvent(eventType, data);
        } catch (e) {
          console.log('[J7Mirror] Parse error:', msg);
        }
      }
    };

    this.ws.onclose = (e) => {
      console.log('[J7Mirror] Disconnected:', e.code, e.reason);
      this.stopPing();
      this.reconnect();
    };

    this.ws.onerror = (e) => {
      console.error('[J7Mirror] Error:', e);
    };
  }

  handleEvent(type, data) {
    console.log(`[J7Mirror] ${type}:`, data);
    
    // Dispatch custom events your UI can listen to
    window.dispatchEvent(new CustomEvent('j7-' + type, { detail: data }));
    
    // Also dispatch a generic event for catch-all handling
    window.dispatchEvent(new CustomEvent('j7-message', { 
      detail: { type, data } 
    }));
  }

  startPing() {
    // Socket.IO expects ping/pong to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('2');
      }
    }, 25000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  reconnect() {
    if (this.reconnectAttempts < 5) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`[J7Mirror] Reconnecting in ${delay}ms...`);
      setTimeout(() => this.connect(), delay);
    }
  }

  disconnect() {
    this.stopPing();
    if (this.ws) this.ws.close();
  }
}

// === USAGE ===
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5vbGFuIiwiaXAiOiI1MC4xMjYuMTMxLjIzMCIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjkxOTI4MDcsImV4cCI6MTc2OTc5NzYwN30.vCBXyP-S-CTe2n3z2nbvF8WFnuSJJqZme_AiYRAikXM';

const mirror = new J7SocketMirror(JWT_TOKEN);
mirror.connect();

// Listen for events in your UI:
window.addEventListener('j7-tweet', (e) => {
  console.log('New tweet:', e.detail);
  // Add to your UI here
  if (typeof addJ7TweetToFeed === 'function') {
    addJ7TweetToFeed(e.detail);
  }
});

window.addEventListener('j7-initialTweets', (e) => {
  console.log('Initial tweets:', e.detail);
  // Populate your feed
  if (typeof populateInitialTweets === 'function') {
    populateInitialTweets(e.detail);
  }
});

window.addEventListener('j7-tweet_update', (e) => {
  console.log('Tweet updated:', e.detail);
});

window.addEventListener('j7-quoted_tweet', (e) => {
  console.log('Quote tweet:', e.detail);
});

window.addEventListener('j7-external_message', (e) => {
  console.log('Discord message:', e.detail);
});

// Helper function to add J7 tweets to the feed
function addJ7TweetToFeed(tweet) {
  const tweetFeed = document.getElementById('twitterFeed');
  if (!tweetFeed) return;

  const now = new Date();
  const dateStr = now.toLocaleString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  const username = tweet.handle || tweet.author || 'unknown';
  const displayName = tweet.author || username;
  const avatarText = username.slice(0, 2).toUpperCase();
  const avatarColor = '#3b82f6';

  const tweetCard = document.createElement('div');
  tweetCard.className = 'tweet-card j7-tweet';
  tweetCard.dataset.j7Source = 'true';
  tweetCard.innerHTML = `
    <div class="tweet-header">
      <div class="tweet-author">
        <div class="author-avatar" style="background: ${avatarColor}; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #fff;">${avatarText}</div>
        <div class="author-info">
          <span class="author-name">${displayName}</span>
          <span class="author-handle">@${username.toLowerCase()}</span>
          <span class="tweet-date">${dateStr}</span>
        </div>
        <span class="j7-badge" style="margin-left: 8px; background: #22c55e; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">J7 LIVE</span>
        <button class="tweet-menu">⋮</button>
      </div>
      <button class="tweet-deploy-btn">⚡ DEPLOY</button>
    </div>
    <div class="tweet-action">@${username.toLowerCase()} posted</div>
    <div class="tweet-content">${tweet.text || 'No text content'}</div>
    ${tweet.url ? `<div style="font-size: 10px; color: #555; margin-top: 8px;">📎 <a href="${tweet.url}" target="_blank" style="color: #0ea5e9; text-decoration: none;">${tweet.url}</a></div>` : ''}
  `;

  // Add images if available
  if (tweet.images && tweet.images.length > 0) {
    const imagesHtml = `
      <div class="tweet-images" style="display: flex; gap: 5px; margin-top: 10px; flex-wrap: wrap;">
        ${tweet.images.map(img => `<img src="${img}" style="max-width: 200px; max-height: 200px; border-radius: 8px; object-fit: cover;" alt="Tweet media">`).join('')}
      </div>
    `;
    tweetCard.querySelector('.tweet-content').insertAdjacentHTML('afterend', imagesHtml);
  }

  // Add avatar if available
  if (tweet.profileImage) {
    const avatarEl = tweetCard.querySelector('.author-avatar');
    if (avatarEl) {
      avatarEl.innerHTML = `<img src="${tweet.profileImage}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    }
  }

  tweetFeed.insertBefore(tweetCard, tweetFeed.firstChild);

  // Scroll to show new tweet
  setTimeout(() => {
    tweetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);

  // Show toast notification
  if (window.showToast) {
    window.showToast('🔴 J7 LIVE', `@${username}: ${(tweet.text || '').slice(0, 30)}...`, 'success');
  }

  // Play notification sound if available
  if (window.playSound) {
    window.playSound('ding');
  }
}

// Helper function to populate initial tweets
function populateInitialTweets(tweets) {
  if (!Array.isArray(tweets)) return;
  
  console.log(`[J7Mirror] Populating ${tweets.length} initial tweets...`);
  
  tweets.forEach(tweet => {
    addJ7TweetToFeed(tweet);
  });
}

// Make mirror globally accessible
window.j7Mirror = mirror;

console.log('✅ J7 Socket Mirror initialized and connected!');
