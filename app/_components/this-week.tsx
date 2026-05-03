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

const ANGLE_ASK: Record<RelatedArticle["kind"], string> = {
  context: "歴史背景・構造的文脈を、過去の類似事例と対比しながら深掘りして。",
  counterpoint: "この見方とは異なる視点・反対論を、編集者の中立な距離から整理して。",
  parallel: "類似する過去の事例を 1〜2 つ挙げて、何が同じで何が違うかを比較して。",
};

function buildAngleClaudeUrl(
  card: ThisWeekCardData,
  angle: RelatedArticle,
): string {
  const prompt = [
    `「${card.title}」について、別角度から深掘りしたい。`,
    "",
    `要約: ${card.summary}`,
    "",
    `角度: ${angle.title}`,
    "",
    `観点: ${ANGLE_ASK[angle.kind]}`,
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

function DiscussButton({ href, color, onClick }: { href: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title="Discuss with Claude"
      onClick={(e) => {
        // 親 <a> のカード遷移をキャンセルして Claude を別タブで開く
        e.stopPropagation();
        e.preventDefault();
        onClick();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
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
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.709 15.955l4.72-2.647.079-.23-.079-.128h-.23l-.79-.048-2.695-.073-2.337-.097-2.265-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.146-.103.018-.072-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V8.85l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.486-1.215.62-1.64-.389-3.829-.91-1.312-.328h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.087-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
      </svg>
    </button>
  );
}

function CardChrome({
  card,
  size,
  isRead,
  readAt,
  onDiscussClick,
  onImageClick,
  rightSlot,
}: {
  card: ThisWeekCardData;
  size: "lg" | "sm";
  isRead: boolean;
  readAt: string | null;
  onDiscussClick: () => void;
  onImageClick: () => void;
  rightSlot?: React.ReactNode;
}) {
  const scopeColor = SCOPE_COLOR[card.scope];
  const claudeUrl = buildClaudePromptUrl(card);
  const big = size === "lg";
  const imgHeight = big ? 600 : 240;
  const titleSize = big ? 40 : 20;
  const numSize = big ? 96 : 38;
  const overlayPad = big ? "24px 28px" : "14px 16px";
  const dimColor = "rgba(255,255,255,0.6)";
  const titleColor = isRead ? dimColor : "#FFF";
  const scoreColor = isRead ? dimColor : "#FFF";
  const scopeOpacity = isRead ? 0.5 : 0.85;
  const imgFilter = isRead ? "saturate(0.5)" : "none";
  // 画像なし時の scope 色ブロックは saturate(0.5) ではほぼ変化しないので
  // opacity で別途 dim する。
  const fallbackOpacity = isRead ? 0.55 : 1;
  const [imgError, setImgError] = useState(false);
  const showImg = card.hero_image_url && !imgError;

  return (
    <>
      <a
        href={card.source_urls[0]}
        target="_blank"
        rel="noreferrer"
        onClick={onImageClick}
        className="group/img relative mb-[18px] block overflow-hidden transition-opacity duration-150 active:opacity-90"
      >
        {showImg ? (
          // 素の <img>: ホスト多様性 / リダイレクトで Vercel optimizer が取りこぼすケースを避ける
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.hero_image_url ?? ""}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full object-cover transition-transform duration-500 ease-out group-hover/img:scale-[1.02]"
            style={{ height: imgHeight, filter: imgFilter }}
          />
        ) : (
          <div
            className="w-full transition-transform duration-500 ease-out group-hover/img:scale-[1.02]"
            style={{
              height: imgHeight,
              background: scopeColor,
              opacity: fallbackOpacity,
            }}
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
                className="font-bold uppercase"
                style={{
                  fontSize: big ? 11 : 10,
                  letterSpacing: "0.32em",
                  marginBottom: big ? 12 : 6,
                  opacity: scopeOpacity,
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
              className="cg-num shrink-0 font-light"
              style={{
                fontSize: numSize,
                lineHeight: 0.85,
                letterSpacing: "-0.05em",
                color: scoreColor,
              }}
            >
              {card.significance_score.toFixed(1)}
            </span>
          </div>
        </div>
      </a>
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
          <DiscussButton href={claudeUrl} color={scopeColor} onClick={onDiscussClick} />
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
      type="button"
      onClick={(e) => {
        // 親 <a> のカード遷移をキャンセルしてレイル開閉のみ
        e.stopPropagation();
        e.preventDefault();
        setOpenRail((v) => !v);
      }}
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
        onDiscussClick={onMarkRead}
        onImageClick={onMarkRead}
        rightSlot={trigger}
      />

      {/* S3 side rail (画像の <a> とは独立) */}
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
          {card.related
            .filter((r): r is RelatedArticle => Boolean(r?.kind && r?.title))
            .map((r, i) => (
              <a
                key={`${r.kind}-${i}`}
                href={buildAngleClaudeUrl(card, r)}
                target="_blank"
                rel="noreferrer"
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
        onDiscussClick={onMarkRead}
        onImageClick={onMarkRead}
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
