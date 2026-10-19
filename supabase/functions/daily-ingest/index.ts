import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const publisherEmail = "nextlevelmedia473@outlook.com";
const feeds = [
  { region: "Oyo", query: "Oyo State OR Ibadan Nigeria news" },
  { region: "Osun", query: "Osun State Nigeria news" },
  { region: "Lagos", query: "Lagos State Nigeria news" },
  { region: "Ekiti", query: "Ekiti State Nigeria news" },
  { region: "Federal", query: "Nigeria Presidency OR Senate OR National Assembly news" },
  { region: null, query: "Nigeria breaking news" },
];
const allowedHosts = new Set([
  "news.google.com",
  "punchng.com", "www.punchng.com",
  "premiumtimesng.com", "www.premiumtimesng.com",
  "guardian.ng", "www.guardian.ng",
  "tribuneonlineng.com", "www.tribuneonlineng.com",
  "channelstv.com", "www.channelstv.com",
  "vanguardngr.com", "www.vanguardngr.com",
  "thenationonlineng.net", "www.thenationonlineng.net",
  "dailytrust.com", "www.dailytrust.com",
]);

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function textFromHtml(value: string) {
  return decode(value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s+/g, "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function tagValue(xml: string, tag: string) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"));
  return match ? decode(match[1]) : "";
}

function attributeValue(markup: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markup.match(new RegExp(`\\b${escaped}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function extractItems(xml: string) {
  const items = [...xml.matchAll(/<(?:item|entry)\b[^>]*>([\s\S]*?)<\/(?:item|entry)\s*>/gi)];
  return items.map((match) => match[1]);
}

function itemLink(item: string) {
  const linkTag = item.match(/<link\b([^>]*)\/?>/i);
  const href = linkTag && attributeValue(linkTag[1], "href");
  return href ? decode(href) : tagValue(item, "link");
}

function itemImage(item: string) {
  const imageTag = item.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/i)?.[0];
  return imageTag ? attributeValue(imageTag, "url") : null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
}

function classifyCategory(value: string) {
  const rules: Array<[string, RegExp]> = [
    ["Sports", /\b(football|soccer|sport|super eagles|premier league|afcon|athlete|match|tournament)\b/i],
    ["Entertainment", /\b(entertainment|nollywood|music|movie|film|celebrity|artist|album|concert)\b/i],
    ["Business", /\b(business|economy|economic|market|naira|bank|company|trade|investment|inflation|oil price)\b/i],
    ["Politics", /\b(politic|presiden(?:t|cy|tial)|senate|senator|national assembly|governor|election|minister|cabinet|lawmaker|policy|government)\b/i],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? "General";
}

function regionFor(value: string, suggestedRegion: string | null) {
  const rules: Array<[string, RegExp]> = [
    ["Oyo", /\b(?:oyo(?: state)?|ibadan)\b/i],
    ["Osun", /\b(?:osun(?: state)?|osogbo)\b/i],
    ["Lagos", /\b(?:lagos(?: state)?|ikeja)\b/i],
    ["Ekiti", /\b(?:ekiti(?: state)?|ado-ekiti)\b/i],
    ["Federal", /\b(?:abuja|presiden(?:t|cy|tial)|senate|senator|national assembly|federal government)\b/i],
  ];
  return rules.find(([, pattern]) => pattern.test(value))?.[0] ?? suggestedRegion;
}

function priority(value: string, suggestedRegion: string | null) {
  const region = regionFor(value, suggestedRegion);
  const regionWeight: Record<string, number> = {
    Oyo: 120,
    Osun: 115,
    Lagos: 110,
    Ekiti: 105,
    Federal: 100,
  };
  return region ? regionWeight[region] ?? 0 : 0;
}

async function storeImage(admin: ReturnType<typeof createClient>, imageUrl: string | null, slug: string) {
  if (!imageUrl) return null;
  const permittedHosts = (Deno.env.get("AUTHORIZED_IMAGE_HOSTS") ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !permittedHosts.includes(url.hostname)) return null;

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "NextLevelMediaNewsBot/1.0" },
    });
    const finalUrl = new URL(response.url);
    const contentType = response.headers.get("content-type")?.split(";")[0].toLowerCase() ?? "";
    if (!response.ok || finalUrl.protocol !== "https:" || !permittedHosts.includes(finalUrl.hostname)
      || !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(contentType)) {
      console.warn("Skipping unavailable article image", response.status, url.hostname);
      return null;
    }
    const declaredSize = Number(response.headers.get("content-length") ?? 0);
    if (declaredSize > 8_000_000 || !response.body) return null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalSize += value.byteLength;
      if (totalSize > 8_000_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (!totalSize) return null;
    const bytes = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1].replace(/[^a-z0-9]/g, "");
    const path = `ingested/${slug}.${extension || "jpg"}`;
    const { error } = await admin.storage.from("article-media").upload(path, bytes, { contentType, upsert: true });
    if (error) {
      console.error("Could not upload article image to Supabase Storage", error.message);
      return null;
    }
    return admin.storage.from("article-media").getPublicUrl(path).data.publicUrl;
  } catch (error) {
    console.warn("Could not download article image", url.hostname, error);
    return null;
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return jsonResponse({ error: "Ingestion is not configured" }, 500);

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return jsonResponse({ error: "Authentication required" }, 401);

  let isAuthorized = token === serviceRoleKey;
  if (!isAuthorized) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error } = await authClient.auth.getUser(token);
    if (error) console.warn("Could not validate ingestion caller", error.message);
    isAuthorized = user?.email === publisherEmail;
  }
  if (!isAuthorized) return jsonResponse({ error: "Not authorized" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const candidates: Array<{
    title: string;
    link: string;
    externalId: string;
    sourceName: string;
    snippet: string;
    image: string | null;
    region: string | null;
    publishedAt: string | null;
  }> = [];
  const seenLinks = new Set<string>();

  const feedResults = await Promise.all(feeds.map(async (feed) => {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(feed.query)}&hl=en-NG&gl=NG&ceid=NG:en`;
    try {
      const response = await fetch(rssUrl, {
        signal: AbortSignal.timeout(12_000),
        headers: { "User-Agent": "NextLevelMediaNewsBot/1.0" },
      });
      if (!response.ok) {
        console.warn("News RSS feed returned an unsuccessful response", feed.region ?? "Nigeria", response.status);
        return [];
      }
      return extractItems(await response.text()).slice(0, 12).map((item) => ({
        item,
        feedRegion: feed.region,
      }));
    } catch (error) {
      console.warn("Could not read news RSS feed", feed.region ?? "Nigeria", error);
      return [];
    }
  }));

  for (const feedItem of feedResults.flat()) {
    const item = feedItem.item;
    const title = textFromHtml(tagValue(item, "title"));
    const link = itemLink(item);
    const snippet = textFromHtml(tagValue(item, "description")).slice(0, 500);
    const image = itemImage(item);
    const sourceName = textFromHtml(tagValue(item, "source"));
    const externalId = tagValue(item, "guid") || link;
    const publishedAt = tagValue(item, "pubDate") || tagValue(item, "published");
    if (!title || !link) continue;
    let linkUrl: URL;
    try {
      linkUrl = new URL(link);
    } catch {
      continue;
    }
    if (linkUrl.protocol !== "https:" || !allowedHosts.has(linkUrl.hostname) || seenLinks.has(link)) continue;
    seenLinks.add(link);
    candidates.push({
      title,
      link,
      externalId,
      sourceName,
      snippet,
      image,
      region: feedItem.feedRegion,
      publishedAt: publishedAt && Number.isFinite(Date.parse(publishedAt)) ? new Date(publishedAt).toISOString() : null,
    });
  }

  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const ranked = candidates
    .filter((candidate) => !candidate.publishedAt || Date.parse(candidate.publishedAt) >= cutoff)
    .sort((left, right) => {
      const weight = priority(`${right.title} ${right.snippet}`, right.region) - priority(`${left.title} ${left.snippet}`, left.region);
      return weight || (Date.parse(right.publishedAt ?? "") || 0) - (Date.parse(left.publishedAt ?? "") || 0);
    });

  const candidateIds = [...new Set(ranked.map((candidate) => candidate.externalId))];
  const existingIds = new Set<string>();
  if (candidateIds.length) {
    const { data: existing, error } = await admin.from("articles").select("external_id").in("external_id", candidateIds);
    if (error) {
      console.error("Could not check the RSS candidate list for duplicates", error.message);
      return jsonResponse({ error: "Existing stories could not be checked." }, 500);
    }
    for (const row of existing ?? []) {
      if (row.external_id) existingIds.add(row.external_id);
    }
  }

  const imported: string[] = [];
  const failures: string[] = [];
  for (const candidate of ranked.filter((item) => !existingIds.has(item.externalId))) {
    if (imported.length >= 10) break;
    if (!candidate.snippet) {
      console.warn("Skipping RSS story without a publisher-provided excerpt", candidate.title);
      continue;
    }

    const title = candidate.title;
    const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const imageUrl = await storeImage(admin, candidate.image, slug);
    const snippet = candidate.snippet.slice(0, 500);
    const contentToClassify = `${title} ${snippet}`;
    const row = {
      title,
      slug,
      content: snippet,
      snippet,
      image_url: imageUrl,
      source_url: candidate.link,
      source_name: candidate.sourceName || "Nigerian news source",
      ingestion_source: "google-news-rss",
      external_id: candidate.externalId,
      category: classifyCategory(contentToClassify),
      region: regionFor(contentToClassify, candidate.region),
      status: "published",
      published_at: candidate.publishedAt ?? new Date().toISOString(),
    };
    const { error } = await admin.from("articles").insert(row);
    if (error) {
      console.error("Could not save ingested article", error.message);
      failures.push(candidate.title);
    } else {
      imported.push(title);
    }
  }

  return jsonResponse({ imported: imported.length, titles: imported, failed: failures.length });
});
