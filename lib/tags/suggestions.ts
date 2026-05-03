// 推奨タグ候補。ユーザー（HCMC 在住 PM、抽象指向、AI 対話ネイティブ）と
// 既存シードタグから自然に拡張する方向で 35 強を維持。
// /tags ページで「まだ追加されていないもの」を上位 N 件表示する。

export const RECOMMENDED_TAG_SUGGESTIONS: readonly string[] = [
  // tech / ai
  "semiconductors",
  "ai regulation",
  "ai ethics",
  "quantum computing",
  "robotics",
  "synthetic biology",
  "space industry",
  "cybersecurity",
  "cryptocurrency",
  // economy
  "macroeconomics",
  "central banks",
  "inflation",
  "energy",
  "supply chain",
  "currency",
  "equities",
  // geopolitics
  "geopolitics",
  "us-china",
  "europe",
  "middle east",
  "taiwan",
  "south korea",
  "india",
  "indonesia",
  "g20",
  // society
  "climate change",
  "renewables",
  "demographics",
  "urban planning",
  "healthcare",
  "food security",
  "elections",
  // industry
  "mobility",
  "manufacturing",
  "media",
  "education",
] as const;

export function pickRecommendedTags(
  existing: readonly string[],
  options: { limit?: number; dismissed?: readonly string[] } = {},
): string[] {
  const limit = options.limit ?? 25;
  const seen = new Set(existing.map((s) => s.toLowerCase().trim()));
  const dismissed = new Set(
    (options.dismissed ?? []).map((s) => s.toLowerCase().trim()),
  );
  return RECOMMENDED_TAG_SUGGESTIONS.filter(
    (t) => !seen.has(t.toLowerCase()) && !dismissed.has(t.toLowerCase()),
  ).slice(0, limit);
}
