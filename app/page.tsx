import { EmptyState } from "@takaki/go-design-system";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CardTile, type CardForTile } from "@/app/_components/card-tile";

export const dynamic = "force-dynamic";

interface RawCard {
  id: string;
  title: string;
  summary: string;
  why_important: string;
  source_urls: string[];
  hero_image_url: string | null;
  scope: "world" | "japan" | "vietnam";
  keywords: string[] | null;
  significance_score: number;
  published_at: string;
  card_metadata: { is_read: boolean | null }[] | null;
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cards")
    .select(
      `id, title, summary, why_important, source_urls, hero_image_url,
       scope, keywords, significance_score, published_at,
       card_metadata ( is_read )`,
    )
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="cg-eyebrow mb-4">error</p>
        <p className="cg-body text-[var(--cg-text-secondary)]">
          カードの読み込みに失敗しました: {error.message}
        </p>
      </main>
    );
  }

  const cards = (data ?? []) as RawCard[];

  if (cards.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <EmptyState
          icon={<Compass size={28} />}
          title="まだ今週のカードはありません"
          description="土曜深夜に検出が走るのを待つか、設定ページから手動で実行できます。"
        />
      </main>
    );
  }

  const tiles: CardForTile[] = cards.map((c) => ({
    id: c.id,
    title: c.title,
    summary: c.summary,
    why_important: c.why_important,
    source_urls: c.source_urls,
    hero_image_url: c.hero_image_url,
    scope: c.scope,
    keywords: c.keywords,
    significance_score: Number(c.significance_score),
    published_at: c.published_at,
    is_read: c.card_metadata?.[0]?.is_read === true,
  }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-2">
        <p className="cg-eyebrow">this week</p>
        <h1 className="cg-display mt-2 text-3xl text-[var(--cg-text)]">
          {cards.length} 件の大きな出来事
        </h1>
      </header>

      <ol>
        {tiles.map((c) => (
          <li key={c.id}>
            <CardTile card={c} />
          </li>
        ))}
      </ol>
    </main>
  );
}
