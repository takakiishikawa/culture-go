import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_DIMENSIONS,
  SIGNIFICANCE_THRESHOLD,
  type ScoringDimension,
} from "@/lib/detect/dimensions";

export const metadata = {
  title: "Scoring — culturego",
};

export default async function ScoringRoute() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scoring_dimensions")
    .select("id, label, description, rubric, weight, display_order")
    .order("display_order", { ascending: true });

  let dimensions: ScoringDimension[] = DEFAULT_DIMENSIONS;
  if (!error && data && data.length > 0) {
    dimensions = data.map((d) => ({
      id: d.id as string,
      label: d.label as string,
      description: d.description as string,
      rubric: d.rubric as string,
      weight: Number(d.weight),
      display_order: d.display_order as number,
    }));
  }

  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);

  return (
    <main className="min-h-full bg-white text-[#1A1A1A]">
      <div className="mx-auto max-w-4xl px-14 pt-8 pb-24">
        <header className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
            Scoring
          </p>
          <p className="cg-num text-[11px] uppercase tracking-[0.18em] text-[#999]">
            threshold {SIGNIFICANCE_THRESHOLD} · Σw {weightSum.toFixed(2)}
          </p>
        </header>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#666]">
          重み付き総合スコア = Σ(各軸 × 重み)。
          <span className="cg-num"> {SIGNIFICANCE_THRESHOLD}</span>{" "}
          未満は配信しない。
        </p>

        <div className="mt-12">
          <div
            className="grid items-baseline gap-6 pb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-[#bbb]"
            style={{ gridTemplateColumns: "32px 140px 1fr 60px" }}
          >
            <span>#</span>
            <span>軸</span>
            <span>定義 / 採点基準</span>
            <span className="text-right">w</span>
          </div>
          {dimensions.map((d, i) => (
            <div
              key={d.id}
              className="grid items-baseline gap-6 border-t border-[#F0F0F0] py-5"
              style={{ gridTemplateColumns: "32px 140px 1fr 60px" }}
            >
              <span className="cg-num text-[18px] font-light text-[#bbb]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[15px] font-medium text-[#1A1A1A]">
                {d.label}
              </span>
              <div className="text-sm leading-6 text-[#1A1A1A]">
                <div>{d.description}</div>
                <div className="mt-1.5 text-xs leading-6 text-[#888]">
                  {d.rubric}
                </div>
              </div>
              <span className="cg-num text-right text-[18px] font-light tracking-[-0.02em] text-[#1A1A1A]">
                {d.weight.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
