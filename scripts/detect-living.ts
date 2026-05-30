// CLI からサイゴン・リビング検出を回す（GitHub Actions の週次 cron 用）。
// 必要 env: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 任意 env:
//   DETECT_LOOKBACK_DAYS         直近何日を見るか（既定 45）
//   LIVING_FALLBACK_PUBLISHED_AT 候補が published_at を返さなかった時のフォールバック
//   LIVING_OVERRIDE_PUBLISHED_AT 指定すると候補の日付を無視して全カードをこの日付で
//                                insert。週バックフィル用途で特定週に必ず載せたい時。

import { createAdminClient } from "@/lib/supabase/admin";
import { runLivingDetection } from "@/lib/detect/run-living";

async function main() {
  const sb = createAdminClient();
  const lookback = Number(process.env.DETECT_LOOKBACK_DAYS ?? 45);
  const fallback = process.env.LIVING_FALLBACK_PUBLISHED_AT;
  const override = process.env.LIVING_OVERRIDE_PUBLISHED_AT;
  const summary = await runLivingDetection(sb, {
    lookbackDays: lookback,
    fallbackPublishedAt: fallback,
    overridePublishedAt: override,
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
