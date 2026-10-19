import { NextRequest } from "next/server";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export async function GET(request: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  const urls = [`<url><loc>${escapeXml(`${origin}/`)}</loc></url>`];

  if (isSupabaseConfigured()) {
    for (let offset = 0; offset < 50_000; offset += 1_000) {
      const { data, error } = await supabase
        .from("articles")
        .select("slug, published_at, created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .range(offset, offset + 999);
      if (error) {
        console.error("Could not load articles for the sitemap", error.message);
        break;
      }
      for (const article of data ?? []) {
        const lastModified = article.published_at ?? article.created_at;
        urls.push(`<url><loc>${escapeXml(`${origin}/news/${encodeURIComponent(article.slug)}`)}</loc><lastmod>${escapeXml(new Date(lastModified).toISOString())}</lastmod></url>`);
      }
      if (!data || data.length < 1_000) break;
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
