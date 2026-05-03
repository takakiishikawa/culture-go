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
    .select("id, name, display_order, created_at, updated_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-full bg-white px-14 pt-8 pb-24 text-[#1A1A1A]">
        <header className="mx-auto max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#999]">
            tags
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.018em]">
            タグの読み込みに失敗しました
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#666]">{error.message}</p>
        </header>
      </main>
    );
  }

  const tags = (data ?? []) as Tag[];

  return (
    <main className="min-h-full bg-white px-14 pt-8 pb-24 text-[#1A1A1A]">
      <div className="mx-auto max-w-3xl">
        <header className="border-b border-[#1A1A1A] pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#999]">
            tags
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.018em]">
            興味のあるドメイン
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#666]">
            1 語で簡潔に。並びはドラッグで入れ替えられます。
          </p>
        </header>

        <TagsClient initialTags={tags} />
      </div>
    </main>
  );
}
