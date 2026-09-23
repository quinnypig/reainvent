# re:Sell

A public, interactive satire of a secondary market for conference seats at https://reainvent.com. All listings, titles, codes, prices, and market activity are fictional. Bids, listings, watchlists, and the agent preview run in browser memory and reset on reload. Real username/password accounts persist in Cloudflare D1. Sessions use hashed tokens and HttpOnly cookies; passwords use salted scrypt hashes. No email recovery is provided. Users can delete their accounts. There is no AWS API connection, payment processing, real booking, or seat transfer.

## Development

```bash
npm install
npm run db:local
npm run dev
```

## Verification

```bash
npm run lint
npm test
```

Tests verify public access, retired audit URL blocking, absence of scoring data from public assets and the client bundle, and rejection of transaction POSTs.

## Deployment

```bash
npm run deploy:cloudflare
```

The workflow deploys on pushes to main or manual dispatch after tests pass. Cloudflare credentials must already be configured. The worker serves the public marketplace without the previous password gate.

## Retired audit

The previous audit source, snapshot, and images are retained under `archive/`, outside the public assets and route tree. The worker blocks old data, image, and audit URLs even if stale assets remain. Catalog refresh scheduling and Pangram scoring in CI are disabled. The optional legacy `npm run update` writes only to `archive/catalog-private.json`; it does not affect the public marketplace. Do not move archived files into public assets or import them into application routes.

## Accounts and handoff model

The configured D1 database must have `migrations/0001_accounts.sql` applied before signup works. `npm run db:local` initializes local development; deployment applies remote migrations first. Set `RESELL_DATABASE_ID` to an existing D1 database ID if overriding the configured binding.

The trade preview models a 10% seller fee and both handoff outcomes: success pays 90% to the seller; failure refunds the buyer in full with no payout or fee. All amounts and transitions are simulated. No funds are held and no booking calls occur. The API offers no atomic seat transfer, so release/reserve cannot guarantee acquisition.
