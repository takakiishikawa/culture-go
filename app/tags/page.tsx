import { createClient } from "@/lib/supabase/server";
import type { Tag } from "@/lib/supabase/db";
import { TagsClient } from "./tags-client";

export const metadata = {
  title: "Tags — culturego",
};

export default async function TagsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tags")
    .select("id, name, display_order, created_at, updated_at")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="min-h-full bg-white text-[#1A1A1A]">
        <div className="mx-auto max-w-3xl px-14 pt-8 pb-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
            Tags
          </p>
          <p className="mt-6 text-sm leading-7 text-[#666]">
            Failed to load tags: {error.message}
          </p>
        </div>
      </main>
    );
  }

  const tags = (data ?? []) as Tag[];

  return (
    <main className="min-h-full bg-white text-[#1A1A1A]">
      <div className="mx-auto max-w-3xl px-14 pt-8 pb-24">
        <header className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
            Tags
          </p>
          <p className="cg-num text-[11px] uppercase tracking-[0.18em] text-[#999]">
            {tags.length} {tags.length === 1 ? "tag" : "tags"}
          </p>
        </header>

        <TagsClient initialTags={tags} />
      </div>
    </main>
  );
}
