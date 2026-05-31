import type { CulturegoClient } from "@/lib/supabase/types";

// サイドバーのメニュー語尾に出す「今週の未読数」を計算する。
// 各チャンネルの「最新の発行週」内で is_read != true のカードを数える。
// 週切りは weekly-feed と同じ ICT (UTC+7) Mon-Sun。

export type SidebarChannel = "global" | "hcmc" | "hcmc_living";

export type UnreadCounts = Record<SidebarChannel, number>;

function startOfWeekICT(d: Date): Date {
  const ictMs = d.getTime() + 7 * 60 * 60 * 1000;
  const ict = new Date(ictMs);
  const ictDow = ict.getUTCDay(); // 0=Sun..6=Sat
  const daysBack = ictDow === 0 ? 6 : ictDow - 1;
  const mondayMs = ictMs - daysBack * 86_400_000;
  const monday = new Date(mondayMs);
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
    ),
  );
}

// 1 チャンネル分の未読数。最新カードの週内で is_read != true を数える。
// 1 クエリで最新 N 件を引いて週境界をクライアント側で計算する。
async function unreadForChannel(
  sb: CulturegoClient,
  channel: SidebarChannel,
): Promise<number> {
  // 1 週間に出るカードは 3 件キャップ。lookback 10 件で十分。
  const { data, error } = await sb
    .from("cards")
    .select("published_at, card_metadata ( is_read )")
    .eq("channel", channel)
    .order("published_at", { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) return 0;

  const weekStart = startOfWeekICT(new Date(data[0].published_at)).getTime();

  let unread = 0;
  for (const row of data) {
    const t = new Date(row.published_at).getTime();
    if (t < weekStart) break;
    // card_metadata は 1-to-1 だが PostgREST は配列でも単一でも返しうる。
    const m = row.card_metadata;
    const meta = Array.isArray(m) ? m[0] : m;
    if (!meta || meta.is_read !== true) unread += 1;
  }
  return unread;
}

export async function fetchUnreadCounts(
  sb: CulturegoClient,
): Promise<UnreadCounts> {
  const channels: SidebarChannel[] = ["global", "hcmc", "hcmc_living"];
  const counts = await Promise.all(
    channels.map((ch) => unreadForChannel(sb, ch)),
  );
  return {
    global: counts[0],
    hcmc: counts[1],
    hcmc_living: counts[2],
  };
}
