import type { ReactNode } from "react";
import { EmptyState } from "@takaki/go-design-system";
import { Compass } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ThisWeek,
  type RelatedArticle,
  type ThisWeekCardData,
} from "@/app/_components/this-week";
import { Archive, type ArchiveCardData } from "@/app/_components/archive";

// global（世界の構造シフト）と hcmc（ホーチミン・ローカル）で共有する週次フィード。
// ページ側は channel と表示文言を渡すだけ。

type Channel = "global" | "hcmc";

interface RawCard {
  id: string;
  title: string;
  summary: string;
  why_important: string;
  source_urls: string[];
  hero_image_url: string | null;
  scope: "world" | "japan" | "vietnam";
  hcmc_kind: "practical" | "trivia" | null;
  keywords: string[] | null;
  significance_score: number;
  published_at: string;
  related_articles: RelatedArticle[] | null;
  // card_metadata.card_id は PK で cards.id の FK → PostgREST はこれを 1-to-1
  // と判定し、配列ではなく単一オブジェクト or null を返す。
  card_metadata:
    | { is_read: boolean | null; updated_at: string | null; discussed_at: string | null }
    | { is_read: boolean | null; updated_at: string | null; discussed_at: string | null }[]
    | null;
}

function pickMeta(c: RawCard) {
  const m = c.card_metadata;
  if (!m) return null;
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

// バッジに使う区分。global は scope、hcmc は hcmc_kind を採用する。
function badgeScope(c: RawCard): ThisWeekCardData["scope"] {
  return c.hcmc_kind ?? c.scope;
}

// 週バケット: ICT (UTC+7) の Mon-Sun 切り。
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
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
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
    timeZone: "UTC",
  });
}

function toThisWeek(c: RawCard): ThisWeekCardData {
  const meta = pickMeta(c);
  const isRead = meta?.is_read === true;
  const isDiscussed = !!meta?.discussed_at;
  return {
    id: c.id,
    title: c.title,
    summary: c.summary,
    why_important: c.why_important,
    source_urls: c.source_urls,
    hero_image_url: c.hero_image_url,
    scope: badgeScope(c),
    keywords: c.keywords ?? [],
    significance_score: Number(c.significance_score),
    related: c.related_articles ?? [],
    is_read: isRead,
    read_at: isRead && meta?.updated_at ? formatRelative(meta.updated_at) : null,
    is_discussed: isDiscussed,
    discussed_at: isDiscussed ? formatRelative(meta!.discussed_at!) : null,
  };
}

function toArchive(c: RawCard): ArchiveCardData {
  const meta = pickMeta(c);
  const isRead = meta?.is_read === true;
  const isDiscussed = !!meta?.discussed_at;
  return {
    id: c.id,
    title: c.title,
    scope: badgeScope(c),
    keywords: c.keywords ?? [],
    significance_score: Number(c.significance_score),
    source_urls: c.source_urls,
    is_read: isRead,
    read_at: isRead && meta?.updated_at ? formatRelative(meta.updated_at) : null,
    is_discussed: isDiscussed,
    discussed_at: isDiscussed ? formatRelative(meta!.discussed_at!) : null,
  };
}

export async function WeeklyFeed({
  channel,
  eyebrow,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: {
  channel: Channel;
  eyebrow: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: ReactNode;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cards")
    .select(
      `id, title, summary, why_important, source_urls, hero_image_url,
       scope, hcmc_kind, keywords, significance_score, published_at, related_articles,
       card_metadata ( is_read, updated_at, discussed_at )`,
    )
    .eq("channel", channel)
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
          icon={emptyIcon ?? <Compass size={28} />}
          title={emptyTitle}
          description={emptyDescription}
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
  // 最新週から significance 上位 N 枚だけを「今週」に出す。残りはアーカイブへ。
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
      <header className="flex items-baseline justify-between px-3 pt-8 md:px-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
          {eyebrow} · {formatWeekLabel(latestWeekStart)}
        </p>
      </header>
      <ThisWeek cards={thisWeekCards.map(toThisWeek)} />
      <Archive weeks={pastWeeks} />
    </main>
  );
}
