import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const allowedCategories = new Set(["Politics", "Sports", "Business", "Entertainment", "General"]);
const pageSize = 500;
type SearchArticle = {
  id: string;
  title: string;
  slug: string;
  snippet: string;
  image_url: string | null;
  category: string;
  region: string | null;
  status: string;
  likes_count: number;
  published_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Search is not configured on this deployment." }, { status: 503 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const requestedCategory = request.nextUrl.searchParams.get("category") ?? "";
  if (query.length > 160) {
    return NextResponse.json({ error: "Search terms must be 160 characters or fewer." }, { status: 400 });
  }
  if (requestedCategory && requestedCategory !== "All" && !allowedCategories.has(requestedCategory)) {
    return NextResponse.json({ error: "That news category is not supported." }, { status: 400 });
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const results: Array<Record<string, unknown>> = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .rpc("search_articles", {
        search_query: query || null,
        search_category: requestedCategory && requestedCategory !== "All" ? requestedCategory : null,
      })
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Article search failed", error.message);
      if (error.code === "PGRST202") {
        return NextResponse.json({ error: "Global search is not ready. Apply the search_articles Supabase migration." }, { status: 503 });
      }
      return NextResponse.json({ error: "Articles could not be searched right now." }, { status: 502 });
    }

    const rows: SearchArticle[] = data ?? [];
    results.push(...rows.map((article) => ({
      id: article.id,
      title: article.title,
      slug: article.slug,
      snippet: article.snippet,
      image_url: article.image_url,
      category: article.category,
      region: article.region,
      status: article.status,
      likes_count: article.likes_count,
      published_at: article.published_at,
      created_at: article.created_at,
    })));
    if (rows.length < pageSize) break;
  }

  return NextResponse.json({ articles: results }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=120" },
  });
}
