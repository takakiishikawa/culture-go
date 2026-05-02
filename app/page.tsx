import { EmptyState } from "@takaki/go-design-system";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true });

  if (!count || count === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <EmptyState
          icon={<Compass size={28} />}
          title="まだ今週のカードはありません"
          description="土曜深夜に検出が走るのを待つか、コンセプトページから手動で実行できます。"
        />
      </main>
    );
  }

  // カード一覧 UI は次のターンで。検出が回って件数 > 0 のときの placeholder。
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="cg-eyebrow mb-6">this week</p>
      <h1 className="cg-display text-3xl text-[var(--cg-text)]">
        {count} 件のカードが検出されています
      </h1>
      <p className="mt-4 text-sm text-[var(--cg-text-secondary)]">
        ギャラリー UI は次のリリースで反映されます。
      </p>
    </main>
  );
}
