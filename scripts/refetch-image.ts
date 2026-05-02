// 個別カードの hero_image_url を取り直す。
// 使い方: npm run refetch-image -- "<タイトル部分一致>"
// 必要 env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local 自動読込)

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOgImage } from "@/lib/detect/extract-image";

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error("usage: npm run refetch-image -- \"<title substring>\"");
    process.exit(1);
  }

  const sb = createAdminClient();
  const { data: matches, error } = await sb
    .from("cards")
    .select("id, title, source_urls, hero_image_url")
    .ilike("title", `%${query}%`);

  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }
  if (!matches || matches.length === 0) {
    console.error(`no card matched: ${query}`);
    process.exit(1);
  }

  for (const card of matches) {
    const sourceUrl = (card.source_urls as string[] | null)?.[0];
    console.log(`→ ${card.title}`);
    console.log(`  current: ${card.hero_image_url ?? "(none)"}`);
    if (!sourceUrl) {
      console.log("  skip: no source_urls");
      continue;
    }
    const hero = await fetchOgImage(sourceUrl);
    if (!hero) {
      console.log("  fail: no image extractable from", sourceUrl);
      continue;
    }
    const upd = await sb
      .from("cards")
      .update({ hero_image_url: hero })
      .eq("id", card.id);
    if (upd.error) {
      console.log("  update error:", upd.error.message);
    } else {
      console.log("  updated:", hero);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
