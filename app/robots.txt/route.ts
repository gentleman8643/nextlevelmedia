import { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin;
  const content = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
