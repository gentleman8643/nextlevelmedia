# Next Level Media

## Configure Supabase

1. Set the Supabase project URL and anon key as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the hosting provider. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are also accepted for server-side deployment settings.
2. Apply all SQL migrations in `supabase/migrations` so the standard categories, public `article-media` bucket, and `search_articles` RPC exist.
3. Deploy the ingestion function with `supabase functions deploy daily-ingest`. The function uses the Supabase-provided `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` runtime secrets.
4. Configure the provider environment variables from `.env.example`. Keep `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` server-side; never give them a `NEXT_PUBLIC_` prefix.
5. Set the same high-entropy `CRON_SECRET` on the hosting provider. The scheduled endpoint accepts only requests with that bearer secret; manual requests require a valid publisher session.

The RSS importer publishes publisher-supplied headlines and short excerpts as local article pages, applies the standard categories, and boosts Oyo, Osun, Lagos, Ekiti, and federal coverage. It does not republish full articles. A source's image is copied to Supabase Storage only when that image host has been explicitly authorized as licensed for reuse: set the comma-separated `AUTHORIZED_IMAGE_HOSTS` secret for the Supabase Edge Function. Without that permission, stories use the local `/hero.jpg` brand image.

## Daily ingestion schedules

- Vercel uses `vercel.json` to call `/api/cron/daily-ingest` daily at 06:00 UTC (07:00 West Africa Time).
- Netlify uses `netlify/functions/daily-ingest.mjs` on the same daily schedule and calls the same authenticated endpoint.

Both schedules need the hosting provider's site URL and the same `CRON_SECRET`. The `/admin` **Fetch Latest News Now** button runs the same ingestion function immediately.

## Search and indexing

Run the `search_articles` migration before deploying the app. Global search uses that database function to search published titles, excerpts, article text, categories, and regions. `/sitemap.xml`, `/robots.txt`, per-story metadata, and NewsArticle structured data are served by the app. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS site origin if you use a custom domain.

## Local development and build

Copy `.env.example` to `.env.local`, add the public Supabase project URL and anon key, then run:

```sh
npm ci
npm run typecheck
npm run build
```
