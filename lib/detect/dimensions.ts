import type { CulturegoClient } from "@/lib/supabase/types";

/** 配信される最低スコア（重み付き総合）。これ未満は瑣末ニュースとして除外。 */
export const SIGNIFICANCE_THRESHOLD = 7.0;

/**
 * 信頼性軸の最低許容スコア。総合 score が高くても信頼性がこれ未満のものは
 * defense-in-depth で drop（個人ブログを一次ソースに置いた候補が通り抜けるのを防ぐ）。
 * label に "信頼性" / "reliability" / "trust" を含む軸を対象に判定。
 */
export const RELIABILITY_MIN = 5;

export interface ScoringDimension {
  id: string;
  label: string;
  description: string;
  rubric: string;
  weight: number;
  display_order: number;
}

/**
 * DB の scoring_dimensions が空 / 未作成の場合のフォールバック。
 * 本番ではマイグレーション 0002 を流して DB から読む。
 */
export const DEFAULT_DIMENSIONS: ScoringDimension[] = [
  {
    id: "default-1",
    label: "影響範囲",
    description: "国家・業界・地域全体に影響する出来事",
    rubric: "0=ごく局所的/3=単一国の一部/5=単一国全体/7=複数国・大陸/9=世界全体",
    weight: 0.3,
    display_order: 1,
  },
  {
    id: "default-2",
    label: "構造的変化",
    description: "力学が変わる出来事 — culturego の核となる軸",
    rubric:
      "0=既知トレンドの延長/3=注目に値する新事象/5=想定外の転回/7=力学が変わる転換/9=パラダイム転換",
    weight: 0.4,
    display_order: 2,
  },
  {
    id: "default-3",
    label: "信頼性",
    description: "情報源の確度・検証可能性",
    rubric:
      "0=個人ブログ・コンサル意見・匿名サイト・wordpress 個人 / 3=複数の二次ソース or 業界誌 / 5=主要報道機関 (Reuters, AP, BBC, NHK, 朝日 等) / 7=複数の一次ソース (政府発表 + 当該機関の公式) / 9=公式発表 + 独立検証",
    weight: 0.3,
    display_order: 3,
  },
];

/** dimensions の中から「信頼性」軸を見つけてスコアを返す。無ければ null。 */
export function reliabilityScoreFor(
  dims: ScoringDimension[],
  scoresByPromptKey: Record<string, number>,
): number | null {
  const idx = dims.findIndex((d) =>
    /信頼性|reliab|trust/i.test(d.label),
  );
  if (idx < 0) return null;
  const v = scoresByPromptKey[`dim_${idx + 1}`];
  return typeof v === "number" ? v : null;
}

export async function loadDimensions(
  sb: CulturegoClient,
): Promise<ScoringDimension[]> {
  const { data, error } = await sb
    .from("scoring_dimensions")
    .select("id, label, description, rubric, weight, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    console.warn("[dimensions] failed to load, using defaults:", error.message);
    return DEFAULT_DIMENSIONS;
  }

  if (!data || data.length === 0) return DEFAULT_DIMENSIONS;

  return data.map((d) => ({
    id: d.id as string,
    label: d.label as string,
    description: d.description as string,
    rubric: d.rubric as string,
    weight: Number(d.weight),
    display_order: d.display_order as number,
  }));
}

/** dim_1 / dim_2 / ... の prompt key で受け取ったスコアから重み付き総合を計算 */
export function computeSignificance(
  dims: ScoringDimension[],
  scoresByPromptKey: Record<string, number>,
): number {
  const totalWeight = dims.reduce((s, d) => s + d.weight, 0) || 1;
  const weighted = dims.reduce(
    (acc, d, i) => acc + (scoresByPromptKey[`dim_${i + 1}`] ?? 0) * d.weight,
    0,
  );
  return Math.round((weighted / totalWeight) * 10) / 10;
}
