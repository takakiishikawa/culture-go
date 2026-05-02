"use client";

import { Button, toast } from "@takaki/go-design-system";
import { Play } from "lucide-react";
import { useState } from "react";

export function RunDetectionButton() {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const start = Date.now();
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lookbackDays: 7 }),
      });
      const data = (await res.json()) as
        | {
            ok: true;
            summary: {
              candidatesGenerated: number;
              inserted: number;
              skippedBelowThreshold: number;
              errors: string[];
            };
          }
        | { ok: false; error: string };

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (!data.ok) {
        toast.error(`検出に失敗: ${data.error}`);
        return;
      }
      const s = data.summary;
      toast.success(
        `検出完了 (${elapsed}s): ${s.inserted} 件登録 / ${s.candidatesGenerated} 候補生成 / 閾値未満 ${s.skippedBelowThreshold} 件`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "ネットワークエラー";
      toast.error(`検出に失敗: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading}>
      <Play className="h-4 w-4" />
      {loading ? "検出中…" : "検出を今すぐ実行"}
    </Button>
  );
}
