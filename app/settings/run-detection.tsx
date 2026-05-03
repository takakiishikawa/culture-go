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

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      // Vercel function timeout / 5xx 等で JSON が返らないケース
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = (await res.text()).slice(0, 200);
        toast.error(
          `検出に失敗 (HTTP ${res.status}, ${elapsed}s): ${text || "non-JSON response"}`,
        );
        return;
      }

      const data = (await res.json()) as
        | {
            ok: true;
            summary: {
              candidatesGenerated: number;
              inserted: number;
              skippedBelowThreshold: number;
              skippedLowReliability: number;
              skippedOverWeeklyCap: number;
              errors: string[];
            };
          }
        | { ok: false; error: string };

      if (!data.ok) {
        toast.error(`検出に失敗: ${data.error}`);
        return;
      }
      const s = data.summary;
      toast.success(
        `検出完了 (${elapsed}s): ${s.inserted} 件登録 / 候補 ${s.candidatesGenerated} / 閾値未満 ${s.skippedBelowThreshold} / 信頼性不足 ${s.skippedLowReliability} / 週次キャップ超え ${s.skippedOverWeeklyCap}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "ネットワークエラー";
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      // "Failed to fetch" は Vercel Hobby の 60s 関数タイムアウトが最有力
      const hint =
        message === "Failed to fetch"
          ? `（${elapsed}s で接続が切れた。Vercel 関数タイムアウト 60s の可能性が高い）`
          : "";
      toast.error(`検出に失敗: ${message}${hint}`);
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
