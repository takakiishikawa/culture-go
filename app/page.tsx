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

// 週バケット: ICT (UTC+7) の Mon-Sun 切り。
// 配信 cron が日曜 02:00 ICT に発火 = 月曜始まりの新週直前にその週分をまとめて
// publish するセマンティクス。返り値は Monday 00:00 ICT 相当を UTC date 部に持つ Date
// (= Date.UTC(Y, M, D) where Y/M/D は ICT カレンダー上の月曜)。
function startOfWeekICT(d: Date): Date {
  const ictMs = d.getTime() + 7 * 60 * 60 * 1000;
  const ict = new Date(ictMs);
  const ictDow = ict.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysBack = ictDow === 0 ? 6 : ictDow - 1;
  const mondayMs = ictMs - daysBack * 86_400_000;
  const monday = new Date(mondayMs);
  return new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
    ),
  );
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
  // weekStart は UTC date 部に ICT の月曜カレンダー値を持たせている。
  // 表示も UTC で読めば ICT 月曜の日付がそのまま出る。
  return weekStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
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

  const THIS_WEEK_LIMIT = 3;
  const latestWeekStart = startOfWeekICT(new Date(cards[0].published_at));
  const inLatestWeek: RawCard[] = [];
  const olderCards: RawCard[] = [];
  for (const c of cards) {
    if (new Date(c.published_at).getTime() >= latestWeekStart.getTime()) {
      inLatestWeek.push(c);
    } else {
      olderCards.push(c);
    }
  }
  // 最新週から significance 上位 N 枚だけを「今週」に出す。残りはアーカイブへ降ろす。
  const sortedLatest = [...inLatestWeek].sort(
    (a, b) => Number(b.significance_score) - Number(a.significance_score),
  );
  const thisWeekCards = sortedLatest.slice(0, THIS_WEEK_LIMIT);
  const pastCards = [...sortedLatest.slice(THIS_WEEK_LIMIT), ...olderCards];

  const pastByWeek = new Map<string, RawCard[]>();
  for (const c of pastCards) {
    const w = startOfWeekICT(new Date(c.published_at)).toISOString();
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
