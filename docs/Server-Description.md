# Server Description

## Utilities


### `getSignature()

```js
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





