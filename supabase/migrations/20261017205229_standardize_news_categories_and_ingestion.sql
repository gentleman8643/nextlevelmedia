/*
# Standardize newsroom categories and prepare daily ingestion

1. Modified table: `articles`
- Adds `region` for geographic focus without mixing location into navigation categories.
- Adds `source_name`, `ingestion_source`, and `external_id` to identify imported reporting and prevent duplicate imports.
- Converts existing regional labels into the standard `General` category while preserving their original geography in `region`.
- Converts existing `Federal/Politics` labels into `Politics`.
- Standard categories are now `Politics`, `Sports`, `Business`, `Entertainment`, and `General`.

2. Search
- Adds a full-text search index across titles, snippets, article bodies, categories, and regions.
- Keeps the original full article body and image URL fields so imported stories render natively on-site.

3. Security
- Existing article row-level policies remain in place.
- No existing article data is deleted; this migration only normalizes labels and adds metadata.
*/

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS ingestion_source text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS external_id text;

UPDATE public.articles
SET region = category
WHERE region IS NULL AND category IN ('Osun', 'Oyo', 'Lagos', 'Ekiti');

UPDATE public.articles
SET category = 'Politics'
WHERE category = 'Federal/Politics';

UPDATE public.articles
SET category = 'General'
WHERE category IN ('Osun', 'Oyo', 'Lagos', 'Ekiti');

ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_category_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_category_check
CHECK (category IN ('Politics', 'Sports', 'Business', 'Entertainment', 'General'));

ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_region_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_region_check
CHECK (region IS NULL OR region IN ('Oyo', 'Osun', 'Lagos', 'Ekiti', 'Federal'));

CREATE UNIQUE INDEX IF NOT EXISTS articles_ingestion_external_id_idx
ON public.articles (external_id)
WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS articles_region_idx ON public.articles (region);
CREATE INDEX IF NOT EXISTS articles_full_text_idx ON public.articles USING gin (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(snippet, '') || ' ' || coalesce(content, '') || ' ' || coalesce(category, '') || ' ' || coalesce(region, ''))
);