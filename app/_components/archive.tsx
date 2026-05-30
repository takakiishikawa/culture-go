"use client";

import { useState } from "react";
import { markCardDiscussed, markCardRead } from "@/app/_actions/cards";

// world/japan/vietnam = global チャンネルの scope。
// practical/trivia = サイゴン・シフトの hcmc_kind。
// place/person/ritual = サイゴン・リビングの living_kind。
// すべて同じバッジ枠を共有する。
const SCOPE_COLOR = {
  world: "#1A2B4A",
  japan: "#8B0000",
  vietnam: "#2D5016",
  practical: "#8A5A12",
  trivia: "#9A3B6E",
  place: "#1F5F5B",
  person: "#5A3D8A",
  ritual: "#7A4A1A",
} as const;

const SCOPE_LABEL = {
  world: "WORLD",
  japan: "JAPAN",
  vietnam: "VIETNAM",
  practical: "USEFUL",
  trivia: "FUN",
  place: "PLACE",
  person: "PERSON",
  ritual: "RITUAL",
} as const;

export interface ArchiveCardData {
  id: string;
  title: string;
  summary?: string;
  why_important?: string;
  scope:
    | "world"
    | "japan"
    | "vietnam"
    | "practical"
    | "trivia"
    | "place"
    | "person"
    | "ritual";
  keywords: string[];
  significance_score: number;
  source_urls: string[];
  is_read: boolean;
  read_at: string | null;
  is_discussed: boolean;
  discussed_at: string | null;
}

export interface ArchiveWeek {
  weekLabel: string;
  issueNumber?: number;
  cards: ArchiveCardData[];
}

function ScopeTag({
  scope,
  dim,
}: {
  scope: ArchiveCardData["scope"];
  dim: boolean;
}) {
  const c = SCOPE_COLOR[scope];
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-bold uppercase tracking-[0.32em]"
      style={{ color: c, opacity: dim ? 0.4 : 1 }}
    >
      {SCOPE_LABEL[scope]}
    </span>
  );
}

const KEYWORD_LIMIT = 3;

function KeywordRow({ items, color }: { items: string[]; color: string }) {
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

function ClaudeGlyph({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.709 15.955l4.72-2.647.079-.23-.079-.128h-.23l-.79-.048-2.695-.073-2.337-.097-2.265-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.146-.103.018-.072-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V8.85l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.486-1.215.62-1.64-.389-3.829-.91-1.312-.328h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.087-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

function buildClaudePromptUrl(card: ArchiveCardData): string {
  const isShift = card.scope === "practical" || card.scope === "trivia";
  const isLiving =
    card.scope === "place" || card.scope === "person" || card.scope === "ritual";
  const prompt = (
    isLiving
      ? [
          "以下はホーチミン(サイゴン)の暮らしのテクスチャを切り取った記事。対話を通して深掘りしたい。",
          "",
          "【culturego サイゴン・リビングについて】",
          "culturego のサイゴン・リビングは、ホーチミンで今どう暮らしているかを",
          "場所・人・習慣の物語として週1で切り取るコーナー。",
          "",
          "【記事】",
          `タイトル: ${card.title}`,
          `要約: ${card.summary ?? ""}`,
          `主要ソース: ${card.source_urls[0] ?? ""}`,
          "",
          "【対話したいこと】",
          "",
        ]
      : isShift
      ? [
          "以下はホーチミン(サイゴン)のローカルな話題。対話を通して深掘りしたい。",
          "",
          "【culturego サイゴン・シフトについて】",
          "culturego のサイゴン・シフトは、ホーチミンで暮らす上で",
          "知っておくと役立つこと・会話のネタになる面白いことを週1で集めるコーナー。",
          "",
          "【話題】",
          `タイトル: ${card.title}`,
          `要約: ${card.summary ?? ""}`,
          `主要ソース: ${card.source_urls[0] ?? ""}`,
          "",
          "【対話したいこと】",
          "",
        ]
      : [
          "以下の出来事について、対話を通して理解を深めたい。",
          "",
          "【culturego について】",
          "culturego は「世界の進む方向を読む」ためのスローメディア。",
          "力学が変わる構造的な出来事だけをスコアリングで抽出している。",
          "この記事は「力学が変わる出来事」として検出されたもの。",
          "",
          "【記事】",
          `タイトル: ${card.title}`,
          `要約: ${card.summary ?? ""}`,
          `主要ソース: ${card.source_urls[0] ?? ""}`,
          "",
          "【対話したい論点(例)】",
          "- そもそもこの事象の理解(背景・経緯)",
          "- 世界・日本・ベトナムの構造がどう変わりうるか",
          "- この先どのようなことが起きうるか",
          "",
          "【対話したいこと】",
          "",
        ]
  ).join("\n");
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

function RowDiscussButton({
  card,
  isDiscussed,
  onClick,
}: {
  card: ArchiveCardData;
  isDiscussed: boolean;
  onClick: () => void;
}) {
  const color = SCOPE_COLOR[card.scope];
  const href = buildClaudePromptUrl(card);
  const bg = isDiscussed ? color : "transparent";
  const fg = isDiscussed ? "#FFF" : color;
  const tooltipText = isDiscussed ? "Discussed with Claude" : "Discuss with Claude";
  return (
    <button
      type="button"
      aria-label={tooltipText}
      aria-pressed={isDiscussed}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      className="group/cl relative inline-flex h-6 w-6 items-center justify-center rounded-full border transition-colors"
      style={{ borderColor: color, background: bg, color: fg }}
      onMouseEnter={(e) => {
        if (isDiscussed) return;
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = "#FFF";
      }}
      onMouseLeave={(e) => {
        if (isDiscussed) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = color;
      }}
    >
      <ClaudeGlyph size={11} />
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-[#1A1A1A] px-2 py-1 text-[10px] font-medium tracking-[0.05em] text-white normal-case opacity-0 transition-opacity duration-150 group-hover/cl:opacity-100"
      >
        {tooltipText}
      </span>
    </button>
  );
}

export function Archive({ weeks }: { weeks: ArchiveWeek[] }) {
  const initialRead = new Set<string>();
  const initialDiscussed = new Set<string>();
  for (const w of weeks) {
    for (const c of w.cards) {
      if (c.is_read) initialRead.add(c.id);
      if (c.is_discussed) initialDiscussed.add(c.id);
    }
  }
  const [readIds, setReadIds] = useState<Set<string>>(initialRead);
  const [discussedIds, setDiscussedIds] = useState<Set<string>>(initialDiscussed);

  function recordRead(id: string) {
    if (readIds.has(id)) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markCardRead(id)
      .then((r) => {
        if (!r.ok) console.error("[markCardRead] persist failed:", r.error);
      })
      .catch((e) => console.error("[markCardRead] threw:", e));
  }

  function recordDiscussed(id: string) {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (discussedIds.has(id)) return;
    setDiscussedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markCardDiscussed(id)
      .then((r) => {
        if (!r.ok) console.error("[markCardDiscussed] persist failed:", r.error);
      })
      .catch((e) => console.error("[markCardDiscussed] threw:", e));
  }

  if (weeks.length === 0) return null;

  return (
    <section className="px-3 pb-24 md:px-16">
      <div className="flex items-baseline gap-4 border-b border-[#1A1A1A] pb-7 pt-24">
        <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#1A1A1A]">
          Archive
        </span>
        <span className="flex-1" />
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#999]">
          Past {weeks.length} {weeks.length === 1 ? "issue" : "issues"}
        </span>
      </div>
      {weeks.map((week, wIdx) => (
        <div key={week.weekLabel} className="mt-6">
          <div className="flex items-baseline gap-3.5 pb-3 pt-4">
            {week.issueNumber != null && (
              <span className="text-xs font-bold text-[#1A1A1A]">
                Issue {week.issueNumber}
              </span>
            )}
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-[#999]">
              {week.weekLabel}
            </span>
          </div>
          {week.cards.map((card, cIdx) => {
            const isRead = readIds.has(card.id);
            const isDiscussed = discussedIds.has(card.id);
            const titleColor = isRead ? "#999" : "#1A1A1A";
            const keywordColor = isRead ? "#bbb" : "#999";
            const isFirst = wIdx === 0 && cIdx === 0;
            return (
              <a
                key={card.id}
                href={card.source_urls[0]}
                target="_blank"
                rel="noreferrer"
                onClick={() => recordRead(card.id)}
                className="block py-4 md:grid md:items-center md:gap-6 md:pl-3"
                style={{
                  // grid-template-columns は md:grid の時のみ有効。
                  // mobile (display: block) では無視される。
                  gridTemplateColumns:
                    "100px 60px 1fr 200px 24px 18px",
                  borderTop: isFirst ? "none" : "1px solid #F0F0F0",
                }}
              >
                {/* Mobile: stacked card layout */}
                <div className="flex flex-col gap-2 md:hidden">
                  <div className="flex items-baseline justify-between gap-3">
                    <ScopeTag scope={card.scope} dim={isRead} />
                    <span
                      className="cg-num text-[20px] font-light"
                      style={{ color: titleColor, letterSpacing: "-0.03em" }}
                    >
                      {card.significance_score.toFixed(1)}
                    </span>
                  </div>
                  <span
                    className="text-[15px] font-medium leading-[1.35]"
                    style={{ color: titleColor, letterSpacing: "-0.005em" }}
                  >
                    {card.title}
                  </span>
                  <KeywordRow items={card.keywords} color={keywordColor} />
                  <div className="flex justify-end pt-1">
                    <RowDiscussButton
                      card={card}
                      isDiscussed={isDiscussed}
                      onClick={() => recordDiscussed(card.id)}
                    />
                  </div>
                </div>

                {/* Desktop: original 7-column row */}
                <span className="hidden md:inline">
                  <ScopeTag scope={card.scope} dim={isRead} />
                </span>
                <span
                  className="cg-num hidden text-[22px] font-light md:inline"
                  style={{ color: titleColor, letterSpacing: "-0.03em" }}
                >
                  {card.significance_score.toFixed(1)}
                </span>
                <span
                  className="hidden text-base font-medium md:inline"
                  style={{
                    color: titleColor,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {card.title}
                </span>
                <span className="hidden md:block">
                  <KeywordRow items={card.keywords} color={keywordColor} />
                </span>
                <span className="hidden md:block">
                  <RowDiscussButton
                    card={card}
                    isDiscussed={isDiscussed}
                    onClick={() => recordDiscussed(card.id)}
                  />
                </span>
                <span className="hidden text-base text-[#999] md:inline">→</span>
              </a>
            );
          })}
        </div>
      ))}
    </section>
  );
}
