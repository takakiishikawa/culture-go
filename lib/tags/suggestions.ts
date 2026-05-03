// 推奨タグ候補。ユーザー（HCMC 在住 PM、抽象指向、AI 対話ネイティブ）と
// 既存シードタグから自然に拡張する方向で 35 強を維持。
// /tags ページで「まだ追加されていないもの」を上位 N 件表示する。

export const RECOMMENDED_TAG_SUGGESTIONS: readonly string[] = [
  // テック/AI
  "半導体",
  "AI規制",
  "AI倫理",
  "量子コンピュータ",
  "ロボティクス",
  "合成生物学",
  "宇宙開発",
  "サイバーセキュリティ",
  "暗号資産",
  // 経済
  "マクロ経済",
  "中央銀行",
  "インフレ",
  "エネルギー",
  "サプライチェーン",
  "通貨",
  "株式市場",
  // 地政学
  "地政学",
  "米中関係",
  "欧州",
  "中東",
  "台湾",
  "韓国",
  "インド",
  "インドネシア",
  "G20",
  // 社会
  "気候変動",
  "再生可能エネルギー",
  "人口動態",
  "都市計画",
  "医療",
  "食料安全保障",
  "選挙",
  // 産業
  "モビリティ",
  "製造業",
  "メディア",
  "教育",
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
