# reAInvent

A planned marketplace for individual re:Invent session reservations at https://reainvent.com. Buyers seek reservations for sessions they want; sellers use AI to identify and reserve in-demand sessions and offer them for resale to help cover their trip. Both need their own conference registration.

Inventory and market prices are illustrative. Quotes, watchlists, and the agent preview run in browser memory and reset on reload. Trading is not open: there is no payment processing, AWS booking connection, or seat transfer. The trade calculator models a 10% seller fee and successful or unsuccessful acquisition. Release-and-reserve is not an atomic transfer.

## Development and verification

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm test
```

## Managed accounts

Clerk owns signup, login, email verification, recovery, sessions, profile editing, and account deletion through its packaged React components. Manage users in the Clerk dashboard; no bespoke administrator or email system is maintained here.

1. Create a Clerk production application for `reainvent.com`, enable email signup/verification and account deletion, and complete Clerk's domain/DNS setup.
2. Add `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` as GitHub repository secrets. Production requires `pk_live_` and `sk_live_` keys.
3. Run the **Deploy marketplace** workflow. It uploads the keys to Worker secrets without logging values. Existing Worker secrets persist when the repository secrets are absent.
4. Verify signup, email delivery, logout, login, recovery, and profile deletion on the production domain. These require the actual Clerk application; automated tests cover the adapter and retired local endpoints, not live delivery.

For development, put test keys in ignored `.dev.vars`; optionally set `AUTH_DEV_ORIGIN` to your exact development origin for backend session verification. Never commit secret keys. `/api/auth/config` exposes only the publishable key. `/api/account` uses Clerk's backend SDK to verify session tokens and restrict authorized origins. Legacy password endpoints return 410. Unconfigured authentication shows a temporary-unavailability message; the marketplace stays public.

No local passwords or auth tokens are stored. The former D1 database and historical migrations are retained but are no longer bound to the Worker or provisioned by deployment. No existing database was deleted.

## Deployment

Push to `main` or manually run **Deploy marketplace** after configuring the existing Cloudflare token. `npm run deploy:cloudflare` is also available locally; `node scripts/configure-auth.mjs` uploads Clerk keys from environment variables after deployment.

## Retired audit

The prior audit source, snapshot, and images remain under `archive/`, outside public assets and routes. Old data, image, and audit URLs are blocked even if stale assets remain. Catalog refresh scheduling and Pangram scoring in CI are disabled. The optional legacy `npm run update` writes only to `archive/catalog-private.json`; do not import archived files into application routes or public assets.
