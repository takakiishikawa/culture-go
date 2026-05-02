"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchOgImage } from "@/lib/detect/extract-image";
import { revalidatePath } from "next/cache";

export async function markCardRead(cardId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_id" },
  );
}

export type BackfillResult =
  | { ok: true; updated: number; skipped: number }
  | { ok: false; error: string };

/** hero_image_url が空のカードに対して、source_urls[0] の og:image を取りに行く */
export async function backfillHeroImages(): Promise<BackfillResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data: missing, error } = await supabase
    .from("cards")
    .select("id, source_urls")
    .is("hero_image_url", null);

  if (error) return { ok: false, error: error.message };
  if (!missing || missing.length === 0)
    return { ok: true, updated: 0, skipped: 0 };

  // Microlink への rate limit 配慮で並列度 3 まで
  const CONCURRENCY = 3;
  const results: ("updated" | "skipped")[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, async () => {
      while (cursor < missing.length) {
        const i = cursor++;
        const c = missing[i];
        const url = (c.source_urls as string[] | null)?.[0];
        if (!url) {
          results[i] = "skipped";
          continue;
        }
        const hero = await fetchOgImage(url);
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
