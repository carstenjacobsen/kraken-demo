import 'dotenv/config';
import crypto from 'crypto';
import https from 'https';
import querystring from 'querystring';
import readline from 'readline';

const API_KEY = process.env.KRAKEN_API_KEY;
const API_SECRET = process.env.KRAKEN_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('Missing KRAKEN_API_KEY or KRAKEN_API_SECRET in .env');
  process.exit(1);
}

// ── Kraken API ───────────────────────────────────────────────────────────────

function getSignature(path, params, secret) {
  const nonce = params.nonce;
  const postData = querystring.stringify(params);
  const secretBuffer = Buffer.from(secret, 'base64');
  const hash = crypto.createHash('sha256').update(nonce + postData).digest();
  const hmac = crypto.createHmac('sha512', secretBuffer);
  hmac.update(path);
  hmac.update(hash);
  return hmac.digest('base64');
}

function krakenRequest(path, params = {}) {
  return new Promise((resolve, reject) => {
    const nonce = Date.now().toString();
    const postParams = { nonce, ...params };
    const postData = querystring.stringify(postParams);
    const signature = getSignature(path, postParams, API_SECRET);

    const options = {
      hostname: 'api.kraken.com',
      path,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIAT_LIKE = new Set(['ZUSD', 'ZEUR', 'ZGBP', 'ZCAD', 'ZJPY', 'ZAUD', 'USD', 'EUR', 'USDC', 'USDT', 'DAI']);

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ── Commands ─────────────────────────────────────────────────────────────────

async function showBalances() {
  console.log('Fetching balances...\n');
  const balances = await krakenRequest('/0/private/Balance');
  const nonZero = Object.entries(balances).filter(([, v]) => parseFloat(v) > 0);
  const fiat = nonZero.filter(([k]) => FIAT_LIKE.has(k));
  const cryptos = nonZero.filter(([k]) => !FIAT_LIKE.has(k));
  const fmt = (asset, amount) => `  ${asset.padEnd(10)} ${parseFloat(amount).toFixed(8)}`;

  if (fiat.length > 0) {
    console.log('── Fiat / Stablecoin ──────────────────────');
    fiat.forEach(([k, v]) => console.log(fmt(k, v)));
  }
  if (cryptos.length > 0) {
    console.log('\n── Crypto ─────────────────────────────────');
    cryptos.forEach(([k, v]) => console.log(fmt(k, v)));
  }
  if (nonZero.length === 0) console.log('No non-zero balances found.');
}

async function listWithdrawalAddresses(asset) {
  const params = asset ? { asset } : {};
  const result = await krakenRequest('/0/private/WithdrawAddresses', params);
  const addresses = Array.isArray(result) ? result : Object.values(result);

  if (addresses.length === 0) {
    console.log('No saved withdrawal addresses found.');
    console.log('Add addresses at: https://pro.kraken.com/app/settings/withdrawal-addresses');
    return [];
  }

  console.log('\n── Saved Withdrawal Addresses ──────────────');
  addresses.forEach((a) => {
    console.log(`  Key:     ${a.key}`);
    console.log(`  Asset:   ${a.asset}`);
    console.log(`  Address: ${a.address}`);
    if (a.memo) console.log(`  Memo:    ${a.memo}`);
    console.log();
  });
  return addresses;
}

async function sendCrypto() {
  console.log('\nNote: Withdrawal addresses must be pre-registered at pro.kraken.com\n');

  const asset = await prompt('Asset (e.g. XBT, ETH, USDC): ');
  if (!asset) { console.log('Cancelled.'); return; }

  console.log(`\nFetching saved addresses for ${asset}...`);
  const addresses = await listWithdrawalAddresses(asset);

  if (addresses.length === 0) return;

  const key = await prompt('Address key name to send to: ');
  if (!key) { console.log('Cancelled.'); return; }

  const amount = await prompt('Amount to send: ');
  if (!amount || isNaN(parseFloat(amount))) { console.log('Invalid amount.'); return; }

  // Show confirmation
  const chosen = addresses.find((a) => a.key === key);
  console.log('\n── Confirm Withdrawal ──────────────────────');
  console.log(`  Asset:   ${asset}`);
  console.log(`  Key:     ${key}`);
  if (chosen) console.log(`  Address: ${chosen.address}`);
  console.log(`  Amount:  ${amount}`);
  console.log('────────────────────────────────────────────');

  const confirm = await prompt('Type "yes" to confirm: ');
  if (confirm.toLowerCase() !== 'yes') { console.log('Cancelled.'); return; }

  console.log('\nSubmitting withdrawal...');
  const result = await krakenRequest('/0/private/Withdraw', { asset, key, amount });
  console.log(`\nWithdrawal submitted. Reference ID: ${result.refid}`);
}

// ── Main menu ────────────────────────────────────────────────────────────────

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'send') {
    await sendCrypto();
    return;
  }

  if (cmd === 'addresses') {
    const asset = process.argv[3];
    await listWithdrawalAddresses(asset);
    return;
  }

  if (cmd === 'balances' || !cmd) {
    await showBalances();
    return;
  }

  console.log('Usage:');
  console.log('  node index.js                  Show balances');
  console.log('  node index.js balances         Show balances');
  console.log('  node index.js addresses [ASSET] List saved withdrawal addresses');
  console.log('  node index.js send             Send crypto to a saved address');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
