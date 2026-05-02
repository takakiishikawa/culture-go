"use client";

import { Button, toast } from "@takaki/go-design-system";
import { ImageDown } from "lucide-react";
import { useState } from "react";
import { backfillHeroImages } from "@/app/_actions/cards";

export function BackfillImagesButton() {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const result = await backfillHeroImages();
      if (!result.ok) {
        toast.error(`画像の補完に失敗: ${result.error}`);
        return;
      }
      toast.success(
        `画像補完完了: ${result.updated} 件更新 / ${result.skipped} 件スキップ`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={run} disabled={loading} variant="outline">
      <ImageDown className="h-4 w-4" />
      {loading ? "取得中…" : "既存カードの画像を補完"}
    </Button>
  );
}
