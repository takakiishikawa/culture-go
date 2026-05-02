import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/supabase/db";
import { TagsClient } from "./tags-client";

export const metadata = {
  title: "タグ管理 — culturego",
};

export default async function TagsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, user_id, name, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="cg-eyebrow mb-4">tags</p>
        <h1 className="cg-display text-3xl text-[var(--cg-text)]">
          タグの読み込みに失敗しました
        </h1>
        <p className="cg-body-serif mt-4 text-[var(--cg-text-secondary)]">
          {error.message}
        </p>
      </main>
    );
  }

  const tags = (data ?? []) as Tag[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="space-y-3">
        <p className="cg-eyebrow">tags</p>
        <h1 className="cg-display text-3xl text-[var(--cg-text)]">
          興味のあるドメイン
        </h1>
        <p className="cg-body-serif text-[var(--cg-text-secondary)]">
          1 語で簡潔に。並びはドラッグで入れ替えられます。
        </p>
      </header>

      <TagsClient initialTags={tags} />
    </main>
  );
}
