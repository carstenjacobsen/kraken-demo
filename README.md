# Kraken Demo

A Node.js web app for managing a [Kraken](https://kraken.com) account via the Kraken REST API. View balances, send crypto to saved withdrawal addresses, and generate deposit addresses with scannable QR codes.

![Kraken Demo](/docs/kraken-demo.png)
---

## Features

- **Balances** — View all non-zero holdings grouped by crypto and fiat/stablecoin
- **Send** — Withdraw crypto to a pre-registered withdrawal address
- **Deposit** — Get a deposit address for any asset and network, with a QR code ready to scan from Coinbase, Trust Wallet, or any other mobile app

---

## Requirements

- Node.js 18 or later
- A [Kraken](https://kraken.com) account with API access enabled

---

## Setup

**1. Clone the repo**

```bash
git clone https://github.com/carstenjacobsen/kraken-demo.git
cd kraken-demo
```

**2. Install dependencies**

```bash
npm install
```

**3. Create a `.env` file**

```bash
cp .env.example .env
```

Open `.env` and add your Kraken API credentials:

```
KRAKEN_API_KEY=your_api_key_here
KRAKEN_API_SECRET=your_api_secret_here
```

To generate API keys, go to **Kraken → Security → API** and create a key with the following permissions:

| Permission | Required for |
|---|---|
| Query Funds | Viewing balances |
| Query Ledger Entries | Deposit address lookup |
| Withdraw Funds | Sending crypto |

**4. Start the server**

```bash
PORT=4000 npm run server
```

Then open [http://localhost:4000](http://localhost:4000) in your browser.

---

## Usage

### Balances

The dashboard loads your current Kraken balances automatically on startup. Click **Refresh** to reload.

### Send Crypto

> **Note:** Withdrawal addresses must be pre-registered in Kraken before they can be used via the API. Add them at [pro.kraken.com → Settings → Withdrawal Addresses](https://pro.kraken.com/app/settings/withdrawal-addresses).

1. Click the **Send** tab
2. Enter the asset ticker (e.g. `XBT`, `ETH`, `USDC`)
3. Select a saved withdrawal address from the dropdown
4. Enter the amount to send
5. Confirm the transaction in the dialog

### Deposit

1. Click the **Deposit** tab
2. Enter the asset ticker (e.g. `ETH`, `XBT`, `ZUSD`)
3. Select a network/method from the dropdown (e.g. `Bitcoin`, `ERC20`, `Bitcoin Lightning`)
4. Click **Get Deposit Address**
5. Scan the QR code with your mobile wallet app, or click **Copy Address**

---

## Project Structure

```
kraken-demo/
├── server.js          # Express server and Kraken API integration
├── index.js           # CLI version (balances + send)
├── public/
│   └── index.html     # Single-page web UI
├── .env.example       # Environment variable template
└── package.json
```

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/balances` | Returns all non-zero account balances |
| `GET` | `/api/addresses?asset=XBT` | Lists saved withdrawal addresses |
| `POST` | `/api/withdraw` | Submits a withdrawal |
| `GET` | `/api/deposit-methods?asset=ETH` | Lists deposit methods for an asset |
| `GET` | `/api/deposit-address?asset=ETH&method=ERC20` | Returns a deposit address |
| `GET` | `/api/qr?data=<address>` | Returns a QR code as a base64 PNG data URL |

---

## CLI Usage

A command-line interface is also available without starting the web server:

```bash
node index.js                       # Show balances
node index.js balances              # Show balances
node index.js addresses             # List all saved withdrawal addresses
node index.js addresses ETH         # List addresses for a specific asset
node index.js send                  # Interactive send flow
```

---

## Security Notes

- API credentials are read from `.env` and never exposed to the browser
- The `.env` file is not included in the repo — keep it out of version control
- All Kraken API requests are signed server-side using HMAC-SHA512
- Withdrawal addresses must be allowlisted in Kraken before the API will accept them

---

## License

MIT

