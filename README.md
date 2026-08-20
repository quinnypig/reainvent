# Catalog Watch

A public, static tracker and Pangram authorship audit for the AWS re:Invent 2026 session catalog. It scores every description, preserves the catalog history, records additions and edits, confirms removals after two consecutive checks, and publishes a searchable site.

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

The updater fetches every RainFocus page, rejects implausibly small or incomplete scrapes, and writes a deterministic public data file. A missing session is only marked as pulled after it is absent from two consecutive updates. Unchanged Pangram results are preserved; new and edited descriptions are bulk-scored when `PANGRAM_API_KEY` is set.

The GitHub Actions workflow runs at 17 and 47 minutes past each hour, uses the `PANGRAM_API_KEY` repository secret for new scores, commits changes, and verifies the site build. Publishing is intentionally not activated yet; the local version is ready for review first.

Set `NEXT_PUBLIC_SITE_URL` to the final public origin when publishing so social-card URLs are absolute.
