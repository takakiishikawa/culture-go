"use client";

import { useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { markCardRead } from "@/app/_actions/cards";

const SCOPE_LABEL: Record<"world" | "japan" | "vietnam", string> = {
  world: "WORLD",
  japan: "JAPAN",
  vietnam: "VIETNAM",
};

export interface CardForTile {
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
  is_read: boolean;
}

function buildClaudePromptUrl(card: CardForTile): string {
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

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ScopeMark({ scope }: { scope: CardForTile["scope"] }) {
  const letter = scope === "world" ? "W" : scope === "japan" ? "J" : "V";
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950">
      <span
        className="cg-display text-white/15 leading-none"
        style={{ fontSize: "9rem", letterSpacing: "-0.06em" }}
      >
        {letter}
      </span>
    </div>
  );
}

export function CardTile({ card }: { card: CardForTile }) {
  const [isRead, setIsRead] = useState(card.is_read);
  const [imgError, setImgError] = useState(false);

  function recordRead() {
    if (isRead) return;
    setIsRead(true);
    void markCardRead(card.id);
  }

  const claudeUrl = buildClaudePromptUrl(card);
  const primary = card.source_urls[0];
  const showImage = card.hero_image_url && !imgError;

  return (
    <article
      className={
        "group transition-opacity duration-300 " +
        (isRead ? "opacity-50" : "opacity-100")
      }
    >
      <a
        href={primary}
        target="_blank"
        rel="noreferrer"
        onClick={recordRead}
        className="block"
      >
        <div className="relative aspect-[3/2] overflow-hidden rounded-md bg-[var(--cg-surface-2)]">
          {showImage ? (
            // next/image を経由しない: ホスト多様性 / リダイレクト / Vercel image optimizer の
            // 取りこぼしで写真が消えるのを防ぐ。素の <img> なら onError も確実に発火する。
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.hero_image_url ?? ""}
              alt=""
              loading="lazy"
              onError={() => setImgError(true)}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <ScopeMark scope={card.scope} />
          )}

          {/* 上下に黒のグラデーションを敷いて、白文字の可読性を担保 */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          {/* badges (top) */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
            <span className="text-[10px] font-medium tracking-[0.2em] text-white/90">
              {SCOPE_LABEL[card.scope]}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-white/90">
              <Sparkles className="h-3 w-3" />
              {card.significance_score.toFixed(1)}
            </span>
          </div>

          {/* title (overlaid) */}
          <h2
            className="absolute inset-x-0 bottom-0 p-5 text-white"
            style={{ textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}
          >
            <span className="cg-headline block text-xl leading-snug">
              {card.title}
            </span>
          </h2>
        </div>
      </a>

      <div className="mt-3 flex items-center gap-4 text-xs">
        <a
          href={claudeUrl}
          target="_blank"
          rel="noreferrer"
          onClick={recordRead}
          className="inline-flex items-center gap-1 text-[var(--cg-text)] underline-offset-4 hover:underline"
        >
          Claude で深掘り
          <ArrowUpRight className="h-3 w-3" />
        </a>
        {primary && (
          <span className="text-[var(--cg-text-subtle)]">
            {hostnameOf(primary)}
          </span>
        )}
      </div>
    </article>
  );
}
