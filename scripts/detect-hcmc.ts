// CLI からホーチミン・ローカル検出を回す（GitHub Actions の週次 cron 用）。
// 必要 env: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createAdminClient } from "@/lib/supabase/admin";
import { runHcmcDetection } from "@/lib/detect/run-hcmc";

async function main() {
  const sb = createAdminClient();
  const lookback = Number(process.env.DETECT_LOOKBACK_DAYS ?? 7);
  const summary = await runHcmcDetection(sb, { lookbackDays: lookback });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
