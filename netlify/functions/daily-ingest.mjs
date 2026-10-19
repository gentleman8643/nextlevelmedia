export const config = { schedule: "0 6 * * *" };

export default async function dailyIngest(request) {
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    throw new Error("Scheduled ingestion requires the Netlify site URL and CRON_SECRET.");
  }
  const { next_run: nextRun } = await request.json();

  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/cron/daily-ingest`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Daily ingestion returned ${response.status}: ${detail}`);
  }
  console.info("Daily news ingestion completed", nextRun, await response.text());
  return new Response(null, { status: 204 });
}
