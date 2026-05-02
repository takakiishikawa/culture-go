"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
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
    "以下のニュースについて、世界の進む方向の文脈で深掘りしたい。",
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
    "- なぜこの出来事が起きたか（構造的な背景）",
    "- 中長期で何が変わるか",
    "- 私たちが取るべき視点",
  ].join("\n");
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function CardTile({ card }: { card: CardForTile }) {
  const [isRead, setIsRead] = useState(card.is_read);

  function recordRead() {
    if (isRead) return;
    setIsRead(true);
    void markCardRead(card.id);
  }

  const claudeUrl = buildClaudePromptUrl(card);

  return (
    <article
      className={
        "border-t border-[var(--cg-border-subtle)] py-12 transition-opacity " +
        (isRead ? "opacity-50" : "opacity-100")
      }
    >
      {card.hero_image_url && (
        <div className="relative mb-8 aspect-[16/8] w-full overflow-hidden rounded-md bg-[var(--cg-surface-2)]">
          <Image
            src={card.hero_image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="cg-eyebrow">{SCOPE_LABEL[card.scope]}</span>
        <span className="cg-eyebrow text-[var(--cg-text-subtle)]">
          {formatDate(card.published_at)}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--cg-border-subtle)] px-2.5 py-0.5 text-xs tabular-nums text-[var(--cg-text-secondary)]">
          <Sparkles className="h-3 w-3" />
          {card.significance_score.toFixed(1)}
        </span>
      </div>

      <h2 className="cg-display mt-3 text-2xl text-[var(--cg-text)]">
        {card.title}
      </h2>

      <p className="cg-body mt-4 text-[var(--cg-text)]">{card.summary}</p>

      <section className="mt-6 border-l-2 border-[var(--cg-border)] pl-4">
        <p className="cg-eyebrow mb-2">why it matters</p>
        <p className="cg-body text-[var(--cg-text-secondary)]">
          {card.why_important}
        </p>
      </section>

      <footer className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <a
          href={claudeUrl}
          target="_blank"
          rel="noreferrer"
          onClick={recordRead}
          className="inline-flex items-center gap-1 text-[var(--cg-text)] underline-offset-4 hover:underline"
        >
          Claude で深掘り
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        {card.source_urls.slice(0, 3).map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            onClick={recordRead}
            className="inline-flex items-center gap-1 text-[var(--cg-text-secondary)] underline-offset-4 hover:underline hover:text-[var(--cg-text)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {hostnameOf(url)}
          </a>
        ))}
      </footer>
    </article>
  );
}
