"use client";

import { useState } from "react";
import { markCardRead } from "@/app/_actions/cards";

const SCOPE_COLOR = {
  world: "#1A2B4A",
  japan: "#8B0000",
  vietnam: "#2D5016",
} as const;

const SCOPE_LABEL = {
  world: "WORLD",
  japan: "JAPAN",
  vietnam: "VIETNAM",
} as const;

export interface RelatedArticle {
  kind: "context" | "counterpoint" | "parallel";
  title: string;
  source?: string;
  read_minutes?: number;
}

export interface ThisWeekCardData {
  id: string;
  title: string;
  summary: string;
  why_important: string;
  source_urls: string[];
  hero_image_url: string | null;
  scope: "world" | "japan" | "vietnam";
  keywords: string[];
  significance_score: number;
  related: RelatedArticle[];
  is_read: boolean;
  read_at: string | null;
}

function buildClaudePromptUrl(card: ThisWeekCardData): string {
  const prompt = [
    "以下の構造シフトについて、世界の進む方向の文脈で深掘りしたい。",
    "",
    `タイトル: ${card.title}`,
    "",
    `要約: ${card.summary}`,
    "",
    `なぜ重要か: ${card.why_important}`,
    "",
    `主要ソース: ${card.source_urls[0] ?? ""}`,
    "",
    "観点:",
    "- なぜこの動きが起きたか（構造的な背景）",
    "- 中長期で何が変わるか",
    "- 私たちが取るべき視点",
  ].join("\n");
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

const KEYWORD_LIMIT = 3;

function KeywordRow({ items, color = "#999" }: { items: string[]; color?: string }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, KEYWORD_LIMIT);
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em]"
      style={{ color }}
    >
      {shown.map((k, i) => (
        <span key={k} className="inline-flex items-center gap-3">
          <span>{k}</span>
          {i < shown.length - 1 && <span className="opacity-40">·</span>}
        </span>
      ))}
    </div>
  );
}

function DiscussLink({ href, color, onClick }: { href: string; color: string; onClick: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      title="Discuss with Claude"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
      style={{ borderColor: color, color }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = "#FFF";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = color;
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3 3h8v6H6.5L3 11.5V3z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function CardChrome({
  card,
  size,
  isRead,
  readAt,
  onMarkRead,
  rightSlot,
}: {
  card: ThisWeekCardData;
  size: "lg" | "sm";
  isRead: boolean;
  readAt: string | null;
  onMarkRead: () => void;
  rightSlot?: React.ReactNode;
}) {
  const scopeColor = SCOPE_COLOR[card.scope];
  const claudeUrl = buildClaudePromptUrl(card);
  const big = size === "lg";
  const imgHeight = big ? 600 : 240;
  const titleSize = big ? 40 : 20;
  const numSize = big ? 96 : 38;
  const overlayPad = big ? "24px 28px" : "14px 16px";
  const titleColor = isRead ? "rgba(255,255,255,0.6)" : "#FFF";
  const imgFilter = isRead ? "saturate(0.5)" : "none";

  return (
    <>
      <div className="relative mb-[18px]">
        {card.hero_image_url ? (
          // 素の <img>: ホスト多様性 / リダイレクトで Vercel optimizer が取りこぼすケースを避ける
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.hero_image_url}
            alt=""
            loading="lazy"
            className="w-full object-cover"
            style={{ height: imgHeight, filter: imgFilter }}
          />
        ) : (
          <div
            className="w-full"
            style={{ height: imgHeight, background: scopeColor, filter: imgFilter }}
          />
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{
            height: big ? "45%" : "55%",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.85) 80%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 text-white"
          style={{ padding: overlayPad }}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <div
                className="font-bold uppercase opacity-85"
                style={{
                  fontSize: big ? 11 : 10,
                  letterSpacing: "0.32em",
                  marginBottom: big ? 12 : 6,
                }}
              >
                {SCOPE_LABEL[card.scope]}
              </div>
              <h2
                className="m-0 font-semibold [text-wrap:balance]"
                style={{
                  fontSize: titleSize,
                  lineHeight: 1.12,
                  letterSpacing: "-0.018em",
                  color: titleColor,
                  maxWidth: "85%",
                }}
              >
                {card.title}
              </h2>
            </div>
            <span
              className="cg-num shrink-0 font-light text-white"
              style={{
                fontSize: numSize,
                lineHeight: 0.85,
                letterSpacing: "-0.05em",
              }}
            >
              {card.significance_score.toFixed(1)}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-4 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          <KeywordRow items={card.keywords} />
          {isRead && readAt && (
            <span className="text-[10px] uppercase italic tracking-[0.18em] text-[#bbb]">
              · read {readAt}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3.5">
          {rightSlot}
          <a
            href={card.source_urls[0]}
            target="_blank"
            rel="noreferrer"
            onClick={onMarkRead}
            className="border-b border-[#1A1A1A] pb-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1A1A1A]"
          >
            Read
          </a>
          <DiscussLink href={claudeUrl} color={scopeColor} onClick={onMarkRead} />
        </div>
      </div>
    </>
  );
}

function HeroCard({
  card,
  isRead,
  readAt,
  onMarkRead,
}: {
  card: ThisWeekCardData;
  isRead: boolean;
  readAt: string | null;
  onMarkRead: () => void;
}) {
  const [openRail, setOpenRail] = useState(false);
  const hasRelated = card.related.length > 0;

  const trigger = hasRelated ? (
    <button
      onClick={() => setOpenRail((v) => !v)}
      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[#1A1A1A]"
    >
      <span className="block h-px w-3.5 bg-[#1A1A1A]" />
      3 Angles {openRail ? "↑" : "↓"}
    </button>
  ) : null;

  return (
    <article className="relative flex h-full flex-col">
      <CardChrome
        card={card}
        size="lg"
        isRead={isRead}
        readAt={readAt}
        onMarkRead={onMarkRead}
        rightSlot={trigger}
      />

      {/* S3 side rail */}
      {openRail && hasRelated && (
        <aside
          className="absolute top-0 z-10 w-[320px] px-6 py-5 text-white"
          style={{
            right: -340,
            background: "#1A1A1A",
            animation: "cg-fade 240ms ease",
          }}
        >
          <div
            className="mb-[18px] text-[10px] font-bold uppercase tracking-[0.32em]"
            style={{ color: "#999" }}
          >
            3 Angles · AI
          </div>
          {card.related.map((r, i) => (
            <a
              key={`${r.kind}-${i}`}
              href={card.source_urls[0]}
              target="_blank"
              rel="noreferrer"
              onClick={onMarkRead}
              className="block py-4"
              style={{
                borderTop: i > 0 ? "1px solid #333" : "none",
              }}
            >
              <div
                className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.32em]"
                style={{
                  color:
                    SCOPE_COLOR[card.scope] === "#1A2B4A" ? "#8AA4D8" : "#D08080",
                }}
              >
                {r.kind}
              </div>
              <div className="text-sm font-medium leading-[1.4] text-white">
                {r.title}
              </div>
              {r.read_minutes != null && (
                <div className="mt-2 text-[10px] tracking-[0.14em] text-[#888]">
                  {r.read_minutes} MIN READ
                </div>
              )}
            </a>
          ))}
        </aside>
      )}
    </article>
  );
}

function SmallCard({
  card,
  isRead,
  readAt,
  onMarkRead,
}: {
  card: ThisWeekCardData;
  isRead: boolean;
  readAt: string | null;
  onMarkRead: () => void;
}) {
  return (
    <article className="relative flex h-full flex-col">
      <CardChrome
        card={card}
        size="sm"
        isRead={isRead}
        readAt={readAt}
        onMarkRead={onMarkRead}
      />
    </article>
  );
}

export function ThisWeek({ cards }: { cards: ThisWeekCardData[] }) {
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(cards.filter((c) => c.is_read).map((c) => c.id)),
  );

  function recordRead(id: string) {
    if (readIds.has(id)) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    void markCardRead(id);
  }

  if (cards.length === 0) return null;

  const sorted = [...cards].sort(
    (a, b) => b.significance_score - a.significance_score,
  );
  const [hero, ...rest] = sorted;

  return (
    <section className="grid grid-cols-[1.2fr_1fr] gap-10 px-14 pt-7">
      <div className="relative">
        <HeroCard
          card={hero}
          isRead={readIds.has(hero.id)}
          readAt={hero.read_at}
          onMarkRead={() => recordRead(hero.id)}
        />
      </div>
      <div className="flex flex-col gap-10">
        {rest.map((c) => (
          <SmallCard
            key={c.id}
            card={c}
            isRead={readIds.has(c.id)}
            readAt={c.read_at}
            onMarkRead={() => recordRead(c.id)}
          />
        ))}
      </div>
    </section>
  );
}
