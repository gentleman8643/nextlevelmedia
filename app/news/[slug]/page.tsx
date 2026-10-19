import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import NewsArticleClient, { type Article } from "./news-article-client";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type PageProps = { params: { slug: string } };

const getArticle = unstable_cache(async (slug: string) => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, content, snippet, image_url, category, region, source_name, published_at, likes_count")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    console.error("Could not load article for search indexing", error.message);
    return null;
  }
  return data as Article | null;
}, ["published-article-by-slug"], { revalidate: 60 });

function getSiteUrl() {
  const host = headers().get("x-forwarded-host") ?? headers().get("host");
  const protocol = headers().get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : undefined);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await getArticle(params.slug);
  if (!article) return { title: "Story not found | Next Level Media", robots: { index: false, follow: false } };

  const siteUrl = getSiteUrl();
  return {
    title: article.title,
    description: article.snippet,
    alternates: siteUrl ? { canonical: `${siteUrl}/news/${article.slug}` } : undefined,
    openGraph: {
      type: "article",
      title: article.title,
      description: article.snippet,
      url: siteUrl ? `${siteUrl}/news/${article.slug}` : undefined,
      publishedTime: article.published_at ?? undefined,
      images: [{ url: article.image_url || "/hero.jpg", alt: article.title }],
    },
    twitter: { card: "summary_large_image", title: article.title, description: article.snippet, images: [article.image_url || "/hero.jpg"] },
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const article = await getArticle(params.slug);
  if (!article) notFound();
  const siteUrl = getSiteUrl();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.snippet,
    articleSection: article.category,
    datePublished: article.published_at ?? undefined,
    image: article.image_url || (siteUrl ? `${siteUrl}/hero.jpg` : undefined),
    mainEntityOfPage: siteUrl ? `${siteUrl}/news/${article.slug}` : undefined,
    author: { "@type": "Organization", name: "Next Level Media" },
    publisher: {
      "@type": "Organization",
      name: "Next Level Media",
      ...(siteUrl ? { logo: { "@type": "ImageObject", url: `${siteUrl}/hero.jpg` } } : {}),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      {article.source_name && <p className="mx-auto max-w-4xl bg-[#101a2b] px-4 py-3 text-center text-xs leading-5 text-slate-400 sm:px-6">Publisher-provided RSS excerpt from {article.source_name}. This page does not reproduce the full article.</p>}
      <NewsArticleClient slug={params.slug} initialArticle={article} />
    </>
  );
}
