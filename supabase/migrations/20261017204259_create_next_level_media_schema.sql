/*
# Create Next Level Media publishing schema

1. New tables
- `articles`: public news stories with title, slug, body, excerpt, media URL, source, regional category, publication workflow status, scheduling, likes, and timestamps.
- `ads`: administrator-managed advertising placements.
- `comments`: authenticated reader comments linked to articles.

2. Storage
- Creates the public `article-media` bucket for article and ad images.
- Restricts uploads, updates, and deletes to the designated publisher email.

3. Security
- Enables row level security on all new tables.
- Published articles and active ads are readable publicly.
- Comments are publicly readable, but only authenticated users can create comments.
- Only the designated publisher account can create, edit, publish, schedule, or delete articles and ads.
- Comment authors can delete their own comments; the publisher can moderate all comments.

4. Important notes
- The publisher identity is tied to the immutable email claim in the Supabase session token.
- Public content is intentionally shared; management actions are not exposed to anonymous visitors.
*/

CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL,
  snippet text NOT NULL,
  image_url text,
  source_url text,
  category text NOT NULL CHECK (category IN ('Osun', 'Oyo', 'Lagos', 'Ekiti', 'Federal/Politics')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft', 'scheduled')),
  scheduled_for timestamptz,
  likes_count integer NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text NOT NULL,
  target_url text NOT NULL,
  position text NOT NULL CHECK (position IN ('header_banner', 'sidebar', 'in_article')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON public.articles (published_at DESC);
CREATE INDEX IF NOT EXISTS articles_category_idx ON public.articles (category);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles (status);
CREATE INDEX IF NOT EXISTS comments_article_id_idx ON public.comments (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ads_position_active_idx ON public.ads (position, is_active);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_articles" ON public.articles;
CREATE POLICY "public_read_published_articles" ON public.articles FOR SELECT TO anon, authenticated
USING (status = 'published' AND (scheduled_for IS NULL OR scheduled_for <= now()) OR auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');

DROP POLICY IF EXISTS "publisher_insert_articles" ON public.articles;
CREATE POLICY "publisher_insert_articles" ON public.articles FOR INSERT TO authenticated
WITH CHECK (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_update_articles" ON public.articles;
CREATE POLICY "publisher_update_articles" ON public.articles FOR UPDATE TO authenticated
USING (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com') WITH CHECK (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_delete_articles" ON public.articles;
CREATE POLICY "publisher_delete_articles" ON public.articles FOR DELETE TO authenticated
USING (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');

DROP POLICY IF EXISTS "public_read_active_ads" ON public.ads;
CREATE POLICY "public_read_active_ads" ON public.ads FOR SELECT TO anon, authenticated
USING (is_active = true OR auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_insert_ads" ON public.ads;
CREATE POLICY "publisher_insert_ads" ON public.ads FOR INSERT TO authenticated
WITH CHECK (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_update_ads" ON public.ads;
CREATE POLICY "publisher_update_ads" ON public.ads FOR UPDATE TO authenticated
USING (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com') WITH CHECK (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_delete_ads" ON public.ads;
CREATE POLICY "publisher_delete_ads" ON public.ads FOR DELETE TO authenticated
USING (auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');

DROP POLICY IF EXISTS "public_read_comments" ON public.comments;
CREATE POLICY "public_read_comments" ON public.comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_comments" ON public.comments;
CREATE POLICY "authenticated_insert_comments" ON public.comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "author_or_publisher_delete_comments" ON public.comments;
CREATE POLICY "author_or_publisher_delete_comments" ON public.comments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');

INSERT INTO storage.buckets (id, name, public)
VALUES ('article-media', 'article-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_view_article_media" ON storage.objects;
CREATE POLICY "public_view_article_media" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'article-media');
DROP POLICY IF EXISTS "publisher_upload_article_media" ON storage.objects;
CREATE POLICY "publisher_upload_article_media" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'article-media' AND auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_update_article_media" ON storage.objects;
CREATE POLICY "publisher_update_article_media" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'article-media' AND auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com')
WITH CHECK (bucket_id = 'article-media' AND auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');
DROP POLICY IF EXISTS "publisher_delete_article_media" ON storage.objects;
CREATE POLICY "publisher_delete_article_media" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'article-media' AND auth.jwt() ->> 'email' = 'nextlevelmedia473@outlook.com');