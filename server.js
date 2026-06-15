import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';
import { fileURLToPath } from 'url';
import path from 'path';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const API_KEY = process.env.KRAKEN_API_KEY;
const API_SECRET = process.env.KRAKEN_API_SECRET;

// ── Kraken API ───────────────────────────────────────────────────────────────

function getSignature(urlPath, params, secret) {
  const nonce = params.nonce;
  const postData = querystring.stringify(params);
  const secretBuffer = Buffer.from(secret, 'base64');
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const hmac = crypto.createHmac('sha512', secretBuffer);
  hmac.update(urlPath);
  hmac.update(hash);
  return hmac.digest('base64');
}

function krakenRequest(urlPath, params = {}) {
  return new Promise((resolve, reject) => {
    const nonce = Date.now().toString();
    const postParams = { nonce, ...params };
    const postData = querystring.stringify(postParams);
    const signature = getSignature(urlPath, postParams, API_SECRET);

    const options = {
      hostname: 'api.kraken.com',
      path: urlPath,
      method: 'POST',
      headers: {
        'API-Key': API_KEY,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error && parsed.error.length > 0) {
            reject(new Error(parsed.error.join(', ')));
          } else {
            resolve(parsed.result);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/balances', async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'API credentials not configured' });
    }
    const result = await krakenRequest('/0/private/Balance');
    const balances = Object.entries(result)
      .filter(([, v]) => parseFloat(v) > 0)
      .map(([asset, amount]) => ({ asset, amount: parseFloat(amount) }))
      .sort((a, b) => b.amount - a.amount);
    res.json(balances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/addresses', async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'API credentials not configured' });
    }
    const params = req.query.asset ? { asset: req.query.asset } : {};
    const result = await krakenRequest('/0/private/WithdrawAddresses', params);
    const addresses = Array.isArray(result) ? result : Object.values(result);
    res.json(addresses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/withdraw', async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'API credentials not configured' });
    }
    const { asset, key, amount } = req.body;
    if (!asset || !key || !amount) {
      return res.status(400).json({ error: 'asset, key, and amount are required' });
    }
    const result = await krakenRequest('/0/private/Withdraw', { asset, key, amount: String(amount) });
    res.json({ refid: result.refid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/qr', async (req, res) => {
  const { data } = req.query;
  if (!data) return res.status(400).json({ error: 'data is required' });
  try {
    const url = await QRCode.toDataURL(data, { width: 200, margin: 2 });
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deposit-methods', async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'API credentials not configured' });
    }
    const { asset } = req.query;
    if (!asset) return res.status(400).json({ error: 'asset is required' });
    const result = await krakenRequest('/0/private/DepositMethods', { asset });
    res.json(Array.isArray(result) ? result : Object.values(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/deposit-address', async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(500).json({ error: 'API credentials not configured' });
    }
    const { asset, method } = req.query;
    if (!asset || !method) return res.status(400).json({ error: 'asset and method are required' });
    const result = await krakenRequest('/0/private/DepositAddresses', { asset, method });
    res.json(Array.isArray(result) ? result : Object.values(result));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
