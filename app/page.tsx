import { headers } from "next/headers";
import { unstable_cache } from "next/cache";
import { Newsroom, type Article } from "@/components/newsroom";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const getLatestArticles = unstable_cache(async () => {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, snippet, image_url, category, region, likes_count, published_at, created_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(24);
  if (error) {
    console.error("Could not load homepage articles", error.message);
    return [];
  }
  return (data ?? []) as Article[];
}, ["homepage-published-articles"], { revalidate: 60 });

function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default async function HomePage() {
  const articles = await getLatestArticles();

  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (host ? `${protocol}://${host}` : undefined);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: "Next Level Media",
    description: "Independent Nigerian news and public-interest reporting.",
    ...(siteUrl ? { url: siteUrl, logo: `${siteUrl}/hero.jpg` } : {}),
    mainEntityOfPage: {
      "@type": "ItemList",
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.title,
        ...(siteUrl ? { url: `${siteUrl}/news/${article.slug}` } : {}),
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
      />
      <Newsroom initialArticles={articles} />
    </>
  );
}
