// CLI から検出を回す。GitHub Actions 用。
// 必要 env: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { runDetection } from "@/lib/detect/run";

async function main() {
  const lookback = Number(process.env.DETECT_LOOKBACK_DAYS ?? 7);
  const summary = await runDetection({ lookbackDays: lookback });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
