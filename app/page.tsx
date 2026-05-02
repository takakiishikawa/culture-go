import { EmptyState } from "@takaki/go-design-system";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ThisWeek,
  type RelatedArticle,
  type ThisWeekCardData,
} from "@/app/_components/this-week";
import { Archive, type ArchiveCardData } from "@/app/_components/archive";

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
  related_articles: RelatedArticle[] | null;
  card_metadata:
    | { is_read: boolean | null; updated_at: string | null }[]
    | null;
}

function startOfWeekUTC(d: Date): Date {
  // Sunday-start week (matches the土曜深夜配信 cadence — 土曜→日曜境界)
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function formatRelative(iso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toThisWeek(c: RawCard): ThisWeekCardData {
  const meta = c.card_metadata?.[0];
  const isRead = meta?.is_read === true;
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    why_important: c.why_important,
    source_urls: c.source_urls,
    hero_image_url: c.hero_image_url,
    scope: c.scope,
    keywords: c.keywords ?? [],
    significance_score: Number(c.significance_score),
    related: c.related_articles ?? [],
    is_read: isRead,
    read_at: isRead && meta?.updated_at ? formatRelative(meta.updated_at) : null,
  };
}

function toArchive(c: RawCard): ArchiveCardData {
  const meta = c.card_metadata?.[0];
  const isRead = meta?.is_read === true;
  return {
    id: c.id,
    title: c.title,
    scope: c.scope,
    keywords: c.keywords ?? [],
    significance_score: Number(c.significance_score),
    source_urls: c.source_urls,
    is_read: isRead,
    read_at: isRead && meta?.updated_at ? formatRelative(meta.updated_at) : null,
  };
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cards")
    .select(
      `id, title, summary, why_important, source_urls, hero_image_url,
       scope, keywords, significance_score, published_at, related_articles,
       card_metadata ( is_read, updated_at )`,
    )
    .order("published_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="cg-eyebrow mb-4">error</p>
        <p className="cg-body text-[var(--cg-text-secondary)]">
          読み込みに失敗しました: {error.message}
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
          title="今週はまだ届いていません"
          description="土曜深夜に検出が走る。設定から手動でも回せる。"
        />
      </main>
    );
  }

  const latestWeekStart = startOfWeekUTC(new Date(cards[0].published_at));
  const thisWeekCards: RawCard[] = [];
  const pastCards: RawCard[] = [];
  for (const c of cards) {
    if (new Date(c.published_at).getTime() >= latestWeekStart.getTime()) {
      thisWeekCards.push(c);
    } else {
      pastCards.push(c);
    }
  }

  const pastByWeek = new Map<string, RawCard[]>();
  for (const c of pastCards) {
    const w = startOfWeekUTC(new Date(c.published_at)).toISOString();
    const arr = pastByWeek.get(w);
    if (arr) arr.push(c);
    else pastByWeek.set(w, [c]);
  }
  const pastWeeks = [...pastByWeek.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([weekIso, cs]) => ({
      weekLabel: formatWeekLabel(new Date(weekIso)),
      cards: cs.map(toArchive),
    }));

  return (
    <main className="min-h-full bg-white text-[#1A1A1A]">
      <header className="flex items-baseline justify-between px-14 pt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
          This Week · {formatWeekLabel(latestWeekStart)}
        </p>
      </header>
      <ThisWeek cards={thisWeekCards.map(toThisWeek)} />
      <Archive weeks={pastWeeks} />
    </main>
  );
}
