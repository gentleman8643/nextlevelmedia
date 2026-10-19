CREATE OR REPLACE FUNCTION public.search_articles(
  search_query text DEFAULT NULL,
  search_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  snippet text,
  image_url text,
  category text,
  region text,
  status text,
  likes_count integer,
  published_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    article.id,
    article.title,
    article.slug,
    article.snippet,
    article.image_url,
    article.category,
    article.region,
    article.status,
    article.likes_count,
    article.published_at,
    article.created_at
  FROM public.articles AS article
  WHERE article.status = 'published'
    AND (search_category IS NULL OR article.category = search_category)
    AND (
      search_query IS NULL
      OR btrim(search_query) = ''
      OR to_tsvector(
        'english',
        coalesce(article.title, '') || ' '
        || coalesce(article.snippet, '') || ' '
        || coalesce(article.content, '') || ' '
        || coalesce(article.category, '') || ' '
        || coalesce(article.region, '')
      ) @@ websearch_to_tsquery('english', search_query)
      OR article.title ILIKE '%' || search_query || '%'
      OR article.snippet ILIKE '%' || search_query || '%'
      OR article.category ILIKE '%' || search_query || '%'
      OR coalesce(article.region, '') ILIKE '%' || search_query || '%'
    )
  ORDER BY article.published_at DESC NULLS LAST, article.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_articles(text, text) TO anon, authenticated;
