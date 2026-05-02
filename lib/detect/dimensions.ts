import { createAdminClient } from "@/lib/supabase/admin";

/** 配信される最低スコア（重み付き総合）。これ未満は瑣末ニュースとして除外。 */
export const SIGNIFICANCE_THRESHOLD = 7.0;

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
 * 本番ではマイグレーション 0002 を流して DB から読む想定。
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
      "0=単一の二次ソース/3=複数の二次ソース/5=主要報道機関/7=複数の一次ソース/9=公式発表+独立検証",
    weight: 0.3,
    display_order: 3,
  },
];

export async function loadDimensions(): Promise<ScoringDimension[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("scoring_dimensions")
    .select("id, label, description, rubric, weight, display_order")
    .order("display_order", { ascending: true });

  if (error) {
    // テーブル未作成などの致命的エラー時はデフォルトで動く
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
