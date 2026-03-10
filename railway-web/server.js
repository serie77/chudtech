const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Port configuration (Railway provides PORT env variable)
const PORT = process.env.PORT || 3000;

// Token API endpoint - Virginia Railway
const TOKEN_API_URL = process.env.TOKEN_API_URL || 'https://token-api-virginia.up.railway.app';

// Master encryption key (AES-256 requires 32 bytes)
// Generate with: crypto.randomBytes(32).toString('hex')
const ENCRYPTION_KEY = process.env.ENCRYPTION_MASTER_KEY || 'a7f8e3d2c1b6a5947382f1e0d9c8b7a6f5e4d3c2b1a09f8e7d6c5b4a39281706';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// =====================================================
// ENCRYPTION UTILITIES
// =====================================================

function encryptPrivateKey(privateKey) {
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
}

function decryptPrivateKey(encryptedData) {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
}

// Derive public key from private key using Solana Keypair
function derivePublicKey(privateKeyBase58) {
  try {
    // Decode the base58 private key
    const secretKey = bs58.decode(privateKeyBase58);
    
    // Create keypair from secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Return the public key as base58 string
    return keypair.publicKey.toBase58();
  } catch (error) {
    throw new Error('Failed to derive public key: ' + error.message);
  }
}

// =====================================================
// API ENDPOINTS
// =====================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /import - Proxy to Token API to import and encrypt wallet
app.post('/import', async (req, res) => {
  try {
    const { walletPrivateKey } = req.body;
    
    // Validation
    if (!walletPrivateKey) {
      return res.status(400).json({ error: 'Private key is required' });
    }
    
    if (typeof walletPrivateKey !== 'string' || walletPrivateKey.length < 32) {
      return res.status(400).json({ error: 'Invalid private key format' });
    }
    
    // Call Token API /import endpoint to get properly encrypted composite key
    const response = await fetch(`${TOKEN_API_URL}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletPrivateKey })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token API import failed: ${errorText}`);
    }
    
    const result = await response.json();
    
    // Extract public key from composite for logging
    const publicKey = result.wallet.split(':')[0];
    console.log('✅ Wallet imported via Token API:', publicKey);
    
    // Return the composite key from Token API
    res.json({ wallet: result.wallet });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /deploy - Deploy token (decrypt wallet, build, sign, submit)
app.post('/deploy', async (req, res) => {
  try {
    const { platform, name, symbol, image, amount, prio, wallets, website, twitter } = req.body;
    
    // Validation
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({ error: 'At least one wallet is required' });
    }
    
    // Validate platform
    const validPlatforms = ['pump', 'bonk', 'usd1'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ error: 'Unsupported platform' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Token name is required' });
    }
    
    if (!symbol) {
      return res.status(400).json({ error: 'Token symbol is required' });
    }
    
    if (!image) {
      return res.status(400).json({ error: 'Token image is required' });
    }
    
    console.log(`🚀 Deploying ${platform} token: ${name} (${symbol})`);
    console.log(`   Wallets: ${wallets.length}`);
    console.log(`   Amount: ${amount}`);
    
    // Build request for Token API - Send composite keys directly
    // The Token API will handle decryption itself
    const deployRequest = {
      platform,
      name,
      symbol,
      image,
      amount: amount || 0.01,
      prio: prio || 0.001,
      wallets: wallets, // Send composite keys (publicKey:encryptedPrivateKey)
      website,
      twitter
    };
    
    // Call Token API /deploy endpoint
    const response = await fetch(`${TOKEN_API_URL}/deploy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deployRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token API error: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Token deployed:', result.mint);
    
    // Return mint address and signatures
    res.json({
      mint: result.mint,
      signatures: result.signatures
    });
    
  } catch (error) {
    console.error('Deploy error:', error);
    
    // Map specific errors
    if (error.message.includes('generate metadata')) {
      return res.status(400).json({ error: 'Failed to generate metadata' });
    }
    if (error.message.includes('submit transaction')) {
      return res.status(400).json({ error: 'Failed to submit transaction' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// DeepL Translation API proxy
app.post('/api/translate', async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body;
    const DEEPL_API_KEY = process.env.DEEPL_API_KEY || 'b7cbb44f-4d26-4d4b-8334-55aea3d66a6d';
    
    const response = await fetch('https://api.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`
      },
      body: new URLSearchParams({
        text: text,
        source_lang: sourceLang || 'EN',
        target_lang: targetLang || 'ZH',
        model_type: 'prefer_quality_optimized'
      })
    });
    
    const data = await response.json();
    if (data.translations && data.translations[0]) {
      res.json({ success: true, translatedText: data.translations[0].text });
    } else {
      res.json({ success: false, error: 'Translation failed' });
    }
  } catch (error) {
    console.error('Translation error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Fetch tweet data (proxy to VPS server)
app.get('/api/tweet', async (req, res) => {
  try {
    const tweetUrl = req.query.url;
    if (!tweetUrl) {
      return res.status(400).json({ success: false, error: 'Missing url parameter' });
    }
    
    // Proxy to VPS server (HTTP is fine for server-to-server)
    const vpsUrl = `http://149.28.53.76:47291/tweet?url=${encodeURIComponent(tweetUrl)}`;
    console.log('Fetching tweet from VPS:', vpsUrl);
    
    const response = await fetch(vpsUrl);
    if (!response.ok) {
      throw new Error(`VPS returned ${response.status}`);
    }
    
    const data = await response.json();
    console.log('VPS response:', data);
    
    // Forward the response
    res.json(data);
  } catch (error) {
    console.error('Tweet fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch image (proxy for CORS)
app.get('/api/fetch-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    res.set('Content-Type', contentType);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Image fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set GUI fields (for external API calls)
app.post('/api/set-fields', (req, res) => {
  const data = req.body;
  
  // Broadcast to all connected WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'set-gui-fields', data }));
    }
  });
  
  res.json({ success: true, message: 'Fields updated', received: data });
});

app.get('/api/set-fields', (req, res) => {
  const { name, ticker, twitter, website } = req.query;
  const data = {};
  if (name) data.name = name;
  if (ticker) data.ticker = ticker;
  if (twitter) data.twitter = twitter;
  if (website) data.website = website;
  
  // Broadcast to all connected WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'set-gui-fields', data }));
    }
  });
  
  res.json({ success: true, message: 'Fields updated', received: data });
});

// =====================================================
// WEBSOCKET HANDLING
// =====================================================

// Store connected clients
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected. Total: ${clients.size}`);
  
  // Send welcome message
  ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Token Deploy Server' }));
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data.type);
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected. Total: ${clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
});

// Broadcast to all clients (for real-time updates)
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// =====================================================
// START SERVER
// =====================================================

server.listen(PORT, '0.0.0.0', () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Token Deploy Server (2-Step API)    ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║   Port: ${PORT.toString().padEnd(32)}║`);
  console.log(`║   Token API: ${TOKEN_API_URL.padEnd(22)}║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /health         - Health check');
  console.log('  POST /import         - Import wallet (encrypt)');
  console.log('  POST /deploy         - Deploy token (decrypt + sign + submit)');
  console.log('  POST /api/translate  - Translate text (DeepL)');
  console.log('  GET  /api/tweet      - Fetch tweet data');
  console.log('  WS   /               - WebSocket connection');
  console.log('');
  console.log('🔐 Encryption: AES-256-GCM');
  console.log('🚀 Ready for token deployments!');
});
