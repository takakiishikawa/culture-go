// culturego のスコアリング設計
// News Minimalist のマルチ次元スコアリングを参考に、
// 「世界の進む方向を変えうる出来事か」の判定に必要な 5 軸に再構成。

export type ScoringDimensionKey =
  | "scale"
  | "permanence"
  | "novelty"
  | "cross_domain"
  | "credibility";

export interface ScoringDimension {
  key: ScoringDimensionKey;
  label: string;
  weight: number; // 合計 1.0
  description: string;
  /** モデルへ渡す採点ガイド（0–10 の意味付け） */
  rubric: string;
}

export const SCORING_DIMENSIONS: readonly ScoringDimension[] = [
  {
    key: "permanence",
    label: "永続性",
    weight: 0.3,
    description: "その変化はどれだけ長く残るか",
    rubric:
      "0=数日で忘れられる/3=数週間/5=数か月/7=数年単位/9=世代を跨ぐ構造変化",
  },
  {
    key: "scale",
    label: "スケール",
    weight: 0.25,
    description: "影響を受ける人数・地域の広さ",
    rubric:
      "0=ごく一部/3=単一国の一部/5=単一国全体/7=複数国・大陸/9=世界全体",
  },
  {
    key: "novelty",
    label: "新規性",
    weight: 0.2,
    description: "前例の有無・既知の延長か断絶か",
    rubric:
      "0=ありふれた話/3=既知トレンドの延長/5=注目に値する新事象/7=想定外の転回/9=パラダイム転換",
  },
  {
    key: "cross_domain",
    label: "領域横断性",
    weight: 0.15,
    description: "他領域へどれだけ波及するか",
    rubric:
      "0=単一領域内/3=隣接領域に波及/5=2–3 領域に波及/7=多領域に波及/9=社会全体の前提を変える",
  },
  {
    key: "credibility",
    label: "信頼度",
    weight: 0.1,
    description: "ソースの確度・検証可能性",
    rubric:
      "0=単一の二次ソース/3=複数の二次ソース/5=主要報道機関/7=複数の一次ソース/9=公式発表+複数の独立検証",
  },
] as const;

/** これ未満は配信しない（瑣末ニュースを混ぜないため） */
export const SIGNIFICANCE_THRESHOLD = 7.0;

export type DimensionScores = Record<ScoringDimensionKey, number>;

export function computeSignificance(scores: DimensionScores): number {
  const total = SCORING_DIMENSIONS.reduce(
    (acc, d) => acc + (scores[d.key] ?? 0) * d.weight,
    0,
  );
  return Math.round(total * 10) / 10; // 小数 1 桁
}
