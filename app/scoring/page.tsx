import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@takaki/go-design-system";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_DIMENSIONS,
  SIGNIFICANCE_THRESHOLD,
  type ScoringDimension,
} from "@/lib/detect/dimensions";

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
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-6">
      <header className="space-y-1.5">
        <p className="cg-eyebrow">scoring</p>
        <h1 className="cg-display text-2xl text-[var(--cg-text)]">
          「大きな出来事」のスコアリング
        </h1>
        <p className="text-sm text-[var(--cg-text-secondary)]">
          重み付き総合スコア = Σ(各軸 × 重み)。{SIGNIFICANCE_THRESHOLD}{" "}
          未満は配信しない。重み合計 {weightSum.toFixed(2)}。
        </p>
      </header>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead className="w-32">軸</TableHead>
            <TableHead>定義 / 採点基準</TableHead>
            <TableHead className="w-16 text-right">w</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dimensions.map((d, i) => (
            <TableRow key={d.id}>
              <TableCell className="align-top text-[var(--cg-text-subtle)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </TableCell>
              <TableCell className="align-top font-medium">{d.label}</TableCell>
              <TableCell className="align-top">
                <div>{d.description}</div>
                <div className="mt-1 text-xs text-[var(--cg-text-secondary)]">
                  {d.rubric}
                </div>
              </TableCell>
              <TableCell className="align-top text-right tabular-nums">
                {d.weight.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </main>
  );
}
