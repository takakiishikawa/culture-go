import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_DIMENSIONS,
  SIGNIFICANCE_THRESHOLD,
  type ScoringDimension,
} from "@/lib/detect/dimensions";
import { ScoringClient } from "./scoring-client";

export const metadata = {
  title: "スコアリング — culturego",
};

export default async function ScoringRoute() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scoring_dimensions")
    .select("id, label, description, rubric, weight, display_order")
    .order("display_order", { ascending: true });

  let dimensions: ScoringDimension[] = DEFAULT_DIMENSIONS;
  let fromDefaults = true;

  if (!error && data && data.length > 0) {
    dimensions = data.map((d) => ({
      id: d.id as string,
      label: d.label as string,
      description: d.description as string,
      rubric: d.rubric as string,
      weight: Number(d.weight),
      display_order: d.display_order as number,
    }));
    fromDefaults = false;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <p className="cg-eyebrow">scoring rubric</p>
        <h1 className="cg-display text-3xl text-[var(--cg-text)]">
          「大きな出来事」のスコアリング
        </h1>
        <p className="cg-body text-[var(--cg-text-secondary)]">
          重み付き総合スコア = Σ(各軸 × 重み)。{SIGNIFICANCE_THRESHOLD} 未満は配信しない（瑣末ニュース除外のための閾値）。
          軸の追加・編集・削除と重みの変更が可能で、保存後の検出はこのルブリックを参照します。
          特に「構造的変化（力学が変わるか）」が culturego の核です。
        </p>
      </header>

      <ScoringClient initial={dimensions} fromDefaults={fromDefaults} />
    </main>
  );
}
