# AWS? re:AInvent

An unofficial parody, public static tracker, and Pangram authorship audit for the AWS re:Invent 2026 session catalog. It scores every description, preserves the catalog history, records additions and edits, confirms removals after two consecutive checks, and publishes a searchable site.

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The repository includes a current snapshot in `public/data.json`, so local development does not depend on the catalog API.

## Updating the data

```bash
npm run update
```

The updater fetches every RainFocus page, rejects implausibly small or incomplete scrapes, and writes a deterministic public data file. A missing session is only marked as pulled after it is absent from two consecutive updates. Unchanged Pangram results are preserved; new and edited descriptions are bulk-scored when `PANGRAM_API_KEY` is set. Catalog changes are still published when Pangram is temporarily unavailable, with missing scores filled in by a later run.

The GitHub Actions workflow runs at 17 and 47 minutes past each hour, uses the `PANGRAM_API_KEY` repository secret for new scores, commits changes, verifies the build, and deploys it directly to Cloudflare Workers. It needs two repository secrets: `PANGRAM_API_KEY` and `CLOUDFLARE_API_TOKEN`. Until the Cloudflare token is configured, builds still pass but the deploy step is skipped.

## Deployment

The production site is <https://reainvent.com>. It runs directly on Cloudflare Workers and uses a Cloudflare custom domain; there is no Sites or ChatGPT hosting dependency.

```bash
npm run deploy:cloudflare
```

Wrangler must be authenticated with the Cloudflare account that manages `reainvent.com`. The build embeds the production origin by default; set `NEXT_PUBLIC_SITE_URL` only when producing a preview for another origin.
