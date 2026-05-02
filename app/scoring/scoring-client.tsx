"use client";

import {
  Button,
  Input,
  Label,
  Textarea,
  toast,
} from "@takaki/go-design-system";
import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveDimensions } from "./actions";
import type { ScoringDimension } from "@/lib/detect/dimensions";

interface DraftDimension {
  id?: string; // 既存行のみ
  clientKey: string; // React key 用
  label: string;
  description: string;
  rubric: string;
  weight: number;
}

function toDraft(d: ScoringDimension): DraftDimension {
  return {
    id: d.id.startsWith("default-") ? undefined : d.id,
    clientKey: d.id,
    label: d.label,
    description: d.description,
    rubric: d.rubric,
    weight: d.weight,
  };
}

function emptyDraft(): DraftDimension {
  return {
    clientKey: `new-${Math.random().toString(36).slice(2, 8)}`,
    label: "",
    description: "",
    rubric: "",
    weight: 0.1,
  };
}

export function ScoringClient({
  initial,
  fromDefaults,
}: {
  initial: ScoringDimension[];
  fromDefaults: boolean;
}) {
  const [drafts, setDrafts] = useState<DraftDimension[]>(initial.map(toDraft));
  const [isPending, startTransition] = useTransition();

  const weightSum = drafts.reduce(
    (s, d) => s + (Number.isFinite(d.weight) ? d.weight : 0),
    0,
  );
  const weightSumLabel = weightSum.toFixed(2);
  const weightOk = Math.abs(weightSum - 1) < 0.001;

  function update<K extends keyof DraftDimension>(
    index: number,
    key: K,
    value: DraftDimension[K],
  ) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
    );
  }

  function addRow() {
    setDrafts((prev) => [...prev, emptyDraft()]);
  }

  function removeRow(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    if (drafts.length === 0) {
      toast.error("軸を 1 つ以上残してください");
      return;
    }
    startTransition(async () => {
      const result = await saveDimensions({
        dimensions: drafts.map((d) => ({
          id: d.id,
          label: d.label.trim(),
          description: d.description.trim(),
          rubric: d.rubric.trim(),
          weight: Number(d.weight),
        })),
      });
      if (!result.ok) {
        toast.error(`保存に失敗: ${result.error}`);
        return;
      }
      toast.success("スコアリング軸を保存しました");
    });
  }

  return (
    <section className="space-y-6">
      {fromDefaults && (
        <div className="rounded-md border border-[var(--cg-border-subtle)] bg-[var(--cg-surface-2)] p-4 text-sm text-[var(--cg-text-secondary)]">
          DB に scoring_dimensions が無いためデフォルト 3 軸を表示しています。
          保存すると DB に書き込まれ、以降の検出から参照されます。
        </div>
      )}

      <header className="flex items-end justify-between gap-4">
        <div className="text-sm text-[var(--cg-text-secondary)]">
          重み合計:{" "}
          <span
            className={
              weightOk
                ? "text-[var(--cg-text)]"
                : "text-[color:var(--color-warning,#ff8b00)]"
            }
          >
            {weightSumLabel}
          </span>
          {!weightOk && (
            <span className="ml-2 text-xs">
              （1.00 にしておくと総合スコアが直感的）
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4" />
            軸を追加
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "保存中…" : "保存"}
          </Button>
        </div>
      </header>

      <ol className="space-y-4">
        {drafts.map((d, i) => (
          <li
            key={d.clientKey}
            className="space-y-3 rounded-md border border-[var(--cg-border-subtle)] bg-[var(--cg-surface)] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="cg-eyebrow shrink-0 pt-2 tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`${d.clientKey}-label`}>ラベル</Label>
                <Input
                  id={`${d.clientKey}-label`}
                  value={d.label}
                  onChange={(e) => update(i, "label", e.target.value)}
                  placeholder="例: 構造的変化"
                  maxLength={30}
                />
              </div>
              <div className="w-24 space-y-1">
                <Label htmlFor={`${d.clientKey}-weight`}>重み</Label>
                <Input
                  id={`${d.clientKey}-weight`}
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={d.weight}
                  onChange={(e) =>
                    update(i, "weight", Number(e.target.value))
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(i)}
                aria-label={`${d.label || "軸"} を削除`}
                className="mt-6"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${d.clientKey}-desc`}>説明</Label>
              <Input
                id={`${d.clientKey}-desc`}
                value={d.description}
                onChange={(e) => update(i, "description", e.target.value)}
                placeholder="この軸が何を測るか（1 行）"
                maxLength={200}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${d.clientKey}-rubric`}>採点基準 (0–10)</Label>
              <Textarea
                id={`${d.clientKey}-rubric`}
                value={d.rubric}
                onChange={(e) => update(i, "rubric", e.target.value)}
                placeholder="0=… / 3=… / 5=… / 7=… / 9=…"
                maxLength={500}
                rows={3}
              />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
