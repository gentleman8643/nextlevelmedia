import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const publisherEmail = "nextlevelmedia473@outlook.com";

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

async function runIngestion(token: string, url: string, anonKey: string) {
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/daily-ingest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      cache: "no-store",
    });
  } catch (error) {
    console.error("Could not reach the Supabase daily-ingest function", error);
    return NextResponse.json({ error: "The news ingestion service is unavailable." }, { status: 502 });
  }

  const responseText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    console.error("The Supabase daily-ingest function returned invalid JSON", response.status);
    return NextResponse.json({ error: "The news ingestion service returned an invalid response." }, { status: 502 });
  }
  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.json({ error: "Supabase is not configured on this deployment." }, { status: 503 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in as the publisher to fetch news." }, { status: 401 });

  const authClient = createClient(config.url, config.anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Your publisher session is no longer valid." }, { status: 401 });
  if (user.email !== publisherEmail) return NextResponse.json({ error: "Only the designated publisher can fetch news." }, { status: 403 });

  return runIngestion(token, config.url, config.anonKey);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized scheduled request." }, { status: 401 });
  }

  const config = getSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase ingestion credentials are not configured." }, { status: 503 });
  }

  return runIngestion(serviceRoleKey, config.url, config.anonKey);
}
