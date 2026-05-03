"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchOgImage, fetchUnsplashImage } from "@/lib/detect/extract-image";
import { revalidatePath } from "next/cache";

export async function markCardRead(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[markCardRead] no auth user — skipping");
    return;
  }

  const { error } = await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_id" },
  );
  if (error) console.error("[markCardRead] upsert failed:", error);
}

export async function markCardDiscussed(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[markCardDiscussed] no auth user — skipping");
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      discussed_at: now,
      updated_at: now,
    },
    { onConflict: "card_id" },
  );
  if (error) console.error("[markCardDiscussed] upsert failed:", error);
}

export type BackfillResult =
  | { ok: true; updated: number; skipped: number }
  | { ok: false; error: string };

/**
 * hero_image_url が空のカードを 3 段で埋める:
 *   1) source_urls[0] の og:image
 *   2) 同じ HTML スキャンで本文 <img> (fetchOgImage 内で実行)
 *   3) keywords / title を Unsplash で検索 (UNSPLASH_ACCESS_KEY 必須)
 *
 * 過去カードには image_query が無いので keywords を join して代用。
 * Japanese keywords でも Unsplash は多少ヒットするが、英語混じりが望ましい。
 */
export async function backfillHeroImages(): Promise<BackfillResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data: missing, error } = await supabase
    .from("cards")
    .select("id, source_urls, keywords, title")
    .is("hero_image_url", null);

  if (error) return { ok: false, error: error.message };
  if (!missing || missing.length === 0)
    return { ok: true, updated: 0, skipped: 0 };

  const CONCURRENCY = 3;
  const results: ("updated" | "skipped")[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, async () => {
      while (cursor < missing.length) {
        const i = cursor++;
        const c = missing[i];
        const url = (c.source_urls as string[] | null)?.[0];

        // ① og:image / 本文 img
        let hero = url ? await fetchOgImage(url) : null;

        // ② Unsplash フォールバック (keywords 上位 3 個 → title)
        if (!hero) {
          const keywords = (c.keywords as string[] | null) ?? [];
          const query =
            keywords.length > 0
              ? keywords.slice(0, 3).join(" ")
              : ((c.title as string) ?? "");
          hero = await fetchUnsplashImage(query);
        }

        if (!hero) {
          results[i] = "skipped";
          continue;
        }
        const upd = await supabase
          .from("cards")
          .update({ hero_image_url: hero })
          .eq("id", c.id);
        results[i] = upd.error ? "skipped" : "updated";
      }
    }),
  );

  const updated = results.filter((r) => r === "updated").length;
  const skipped = results.length - updated;
  revalidatePath("/");
  return { ok: true, updated, skipped };
}
