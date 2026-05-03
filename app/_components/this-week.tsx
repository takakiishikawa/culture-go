"use client";

import { useMemo, useState } from "react";
import { toast } from "@takaki/go-design-system";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
  generateRelatedForCard,
  markCardDiscussed,
  markCardRead,
} from "@/app/_actions/cards";

// 3 Angles の生成 / 再生成。card.related を local state で持ち、
// generateRelatedForCard 成功時に上書きする。
function useRelatedState(card: { id: string; related: RelatedArticle[] }) {
  const [related, setRelated] = useState<RelatedArticle[]>(card.related);
  const [generating, setGenerating] = useState(false);
  const hasRelated = related.length > 0;

  async function generate(): Promise<boolean> {
    if (generating) return false;
    setGenerating(true);
    const result = await generateRelatedForCard(card.id);
    setGenerating(false);
    if (result.ok) {
      setRelated(result.related as RelatedArticle[]);
      toast.success(
        hasRelated ? "3 Angles を再生成しました" : "3 Angles を生成しました",
      );
      return true;
    }
    toast.error(`生成失敗: ${result.error}`);
    return false;
  }

  return { related, hasRelated, generating, generate };
}

function AnglesTrigger({
  hasRelated,
  generating,
  isOpen,
  onToggle,
  onGenerate,
}: {
  hasRelated: boolean;
  generating: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onGenerate: () => void;
}) {
  // editorial-quiet な hover/press。
  // - 文字ボタン: hover は薄い ink underline、press は scale + opacity
  // - アイコンボタン: hover で円形 BG が浮かび上がる、press は scale
  // tooltip は CSS-only で**カーソル上**に表示 (browser native の title=下表示を避ける)。
  const textBtnBase =
    "group/btn relative inline-flex items-center gap-2 rounded-sm px-1 py-0.5 " +
    "text-[10px] font-bold uppercase tracking-[0.28em] text-[#1A1A1A] " +
    "transition-all duration-150 ease-out " +
    "hover:bg-[#F5F5F2] " +
    "active:scale-[0.97] active:opacity-80 " +
    "disabled:cursor-not-allowed disabled:opacity-50 " +
    "disabled:hover:bg-transparent";

  const iconBtnBase =
    "group/btn relative inline-flex h-6 w-6 items-center justify-center rounded-full " +
    "text-[#999] transition-all duration-150 ease-out " +
    "hover:bg-[#F0F0F0] hover:text-[#1A1A1A] " +
    "active:scale-90 active:bg-[#EAEAEA] " +
    "disabled:cursor-not-allowed disabled:opacity-50 " +
    "disabled:hover:bg-transparent disabled:hover:text-[#999]";

  // CSS-only tooltip (カーソル上に表示, hover で fade-in)
  const tooltipClass =
    "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 " +
    "whitespace-nowrap rounded bg-[#1A1A1A] px-2 py-1 " +
    "text-[10px] font-medium tracking-[0.05em] text-white normal-case " +
    "opacity-0 transition-opacity duration-150 " +
    "group-hover/btn:opacity-100";

  // 生成済み: [3 Angles ↓] [↻]
  if (hasRelated) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggle();
          }}
          aria-expanded={isOpen}
          className={textBtnBase}
        >
          <span
            className="block h-px w-3.5 bg-[#1A1A1A] transition-all duration-200 group-hover/btn:w-5"
            aria-hidden
          />
          3 Angles {isOpen ? "↑" : "↓"}
        </button>
        <button
          type="button"
          aria-label="Regenerate 3 Angles"
          disabled={generating}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onGenerate();
          }}
          className={iconBtnBase}
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          <span className={tooltipClass}>3 Angles を再生成</span>
        </button>
      </span>
    );
  }
  // 未生成: [✨ Generate Angles]
  return (
    <button
      type="button"
      disabled={generating}
      aria-label="Generate 3 Angles"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onGenerate();
      }}
      className={textBtnBase}
    >
      {generating ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3 transition-transform duration-200 group-hover/btn:rotate-12" />
      )}
      {generating ? "Generating…" : "Generate Angles"}
      <span className={tooltipClass}>このカード用に 3 Angles を生成</span>
    </button>
  );
}

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
  url: string;
  source?: string;
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
  is_discussed: boolean;
  discussed_at: string | null;
}

function buildClaudePromptUrl(card: ThisWeekCardData): string {
  const prompt = [
    "以下の出来事について、対話を通して理解を深めたい。",
    "",
    "【culturego について】",
    "culturego は「世界の進む方向を読む」ためのスローメディア。",
    "力学が変わる構造的な出来事だけをスコアリングで抽出している。",
    "この記事は「力学が変わる出来事」として検出されたもの。",
    "",
    "【記事】",
    `タイトル: ${card.title}`,
    `要約: ${card.summary}`,
    `主要ソース: ${card.source_urls[0] ?? ""}`,
    "",
    "【対話したい論点(例)】",
    "- そもそもこの事象の理解(背景・経緯)",
    "- 世界・日本・ベトナムの構造がどう変わりうるか",
    "- この先どのようなことが起きうるか",
    "",
    "【対話したいこと】",
    "",
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

// Claude logo (small)
function ClaudeGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.709 15.955l4.72-2.647.079-.23-.079-.128h-.23l-.79-.048-2.695-.073-2.337-.097-2.265-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.146-.103.018-.072-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V8.85l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.486-1.215.62-1.64-.389-3.829-.91-1.312-.328h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.087-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" />
    </svg>
  );
}

function DiscussButton({
  href,
  color,
  isDiscussed,
  onClick,
}: {
  href: string;
  color: string;
  isDiscussed: boolean;
  onClick: () => void;
}) {
  // 「対話済み」= scope 色で塗りつぶし + 白アイコン。未対話は線のみ。
  // ホバーは未対話のときだけ反転させる(対話済みは触っても見た目変えない=済みのサイン)
  const baseBg = isDiscussed ? color : "transparent";
  const baseFg = isDiscussed ? "#FFF" : color;
  return (
    <button
      type="button"
      title={isDiscussed ? "Discussed with Claude" : "Discuss with Claude"}
      aria-pressed={isDiscussed}
      onClick={(e) => {
        // 親 <a> のカード遷移をキャンセルして Claude を別タブで開く
        e.stopPropagation();
        e.preventDefault();
        onClick();
        window.open(href, "_blank", "noopener,noreferrer");
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
      style={{ borderColor: color, background: baseBg, color: baseFg }}
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
      <ClaudeGlyph size={14} />
    </button>
  );
}

function CardChrome({
  card,
  size,
  isRead,
  isDiscussed,
  onDiscussClick,
  onImageClick,
  rightSlot,
}: {
  card: ThisWeekCardData;
  size: "lg" | "sm";
  isRead: boolean;
  isDiscussed: boolean;
  onDiscussClick: () => void;
  onImageClick: () => void;
  rightSlot?: React.ReactNode;
}) {
  const scopeColor = SCOPE_COLOR[card.scope];
  const claudeUrl = buildClaudePromptUrl(card);
  const big = size === "lg";
  const imgHeight = big ? 553 : 221;
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
            // Referer ベースの hotlinking 保護 (Eurasia Group 等) で 403 になるのを回避。
            // 第三者サイトからの <img> に Referer を送らないことで、no-Referer 扱いに。
            referrerPolicy="no-referrer"
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
        </div>
        <div className="flex items-center gap-3.5">
          {rightSlot}
          <DiscussButton
            href={claudeUrl}
            color={scopeColor}
            isDiscussed={isDiscussed}
            onClick={onDiscussClick}
          />
        </div>
      </div>
    </>
  );
}

function ThreeAnglesPanel({
  card,
  layout,
}: {
  card: ThisWeekCardData;
  layout: "side" | "below";
}) {
  const items = card.related.filter((r): r is RelatedArticle =>
    Boolean(r?.kind && r?.title && r?.url),
  );
  const accent = SCOPE_COLOR[card.scope] === "#1A2B4A" ? "#8AA4D8" : "#D08080";

  if (layout === "side") {
    return (
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
          3 Angles
        </div>
        {items.map((r, i) => (
          <a
            key={`${r.kind}-${i}`}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="group/angle -mx-6 block px-6 py-4 transition-all duration-150 ease-out hover:bg-[#242424] active:scale-[0.99] active:bg-[#2a2a2a]"
            style={{ borderTop: i > 0 ? "1px solid #333" : "none" }}
          >
            <div
              className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.32em]"
              style={{ color: accent }}
            >
              {r.kind}
            </div>
            <div className="text-sm font-medium leading-[1.4] text-white transition-colors group-hover/angle:text-white">
              {r.title}
            </div>
            {r.source && (
              <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#888] transition-colors group-hover/angle:text-[#bbb]">
                {r.source}
              </div>
            )}
          </a>
        ))}
      </aside>
    );
  }

  // "below" layout (1/2記事モード用): カード幅にフィットする 3 列パネル
  return (
    <div
      className="mt-3 px-6 py-5 text-white"
      style={{ background: "#1A1A1A", animation: "cg-fade 240ms ease" }}
    >
      <div
        className="mb-[14px] text-[10px] font-bold uppercase tracking-[0.32em]"
        style={{ color: "#999" }}
      >
        3 Angles · AI
      </div>
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
        {items.map((r, i) => (
          <a
            key={`${r.kind}-${i}`}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="group/angle -mx-3 block rounded-sm px-3 py-3 transition-all duration-150 ease-out hover:bg-[#242424] active:scale-[0.99] active:bg-[#2a2a2a]"
            style={{ borderTop: "1px solid #333" }}
          >
            <div
              className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.32em]"
              style={{ color: accent }}
            >
              {r.kind}
            </div>
            <div className="text-sm font-medium leading-[1.4] text-white">
              {r.title}
            </div>
            {r.source && (
              <div className="mt-2 text-[10px] uppercase tracking-[0.18em] text-[#888] transition-colors group-hover/angle:text-[#bbb]">
                {r.source}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function HeroCard({
  card,
  isRead,
  isDiscussed,
  onMarkRead,
  onMarkDiscussed,
  railPlacement = "side",
}: {
  card: ThisWeekCardData;
  isRead: boolean;
  isDiscussed: boolean;
  onMarkRead: () => void;
  onMarkDiscussed: () => void;
  railPlacement?: "side" | "below";
}) {
  const [openRail, setOpenRail] = useState(false);
  const { related, hasRelated, generating, generate } = useRelatedState(card);
  const cardWithLocalRelated = useMemo(
    () => ({ ...card, related }),
    [card, related],
  );

  const trigger = (
    <AnglesTrigger
      hasRelated={hasRelated}
      generating={generating}
      isOpen={openRail}
      onToggle={() => setOpenRail((v) => !v)}
      onGenerate={async () => {
        const ok = await generate();
        if (ok) setOpenRail(true);
      }}
    />
  );

  return (
    <article className="relative flex h-full flex-col">
      <CardChrome
        card={card}
        size="lg"
        isRead={isRead}
        isDiscussed={isDiscussed}
        onDiscussClick={onMarkDiscussed}
        onImageClick={onMarkRead}
        rightSlot={trigger}
      />

      {openRail && hasRelated && (
        <ThreeAnglesPanel card={cardWithLocalRelated} layout={railPlacement} />
      )}
    </article>
  );
}

function SmallCard({
  card,
  isRead,
  isDiscussed,
  onMarkRead,
  onMarkDiscussed,
}: {
  card: ThisWeekCardData;
  isRead: boolean;
  isDiscussed: boolean;
  onMarkRead: () => void;
  onMarkDiscussed: () => void;
}) {
  const [openRail, setOpenRail] = useState(false);
  const { related, hasRelated, generating, generate } = useRelatedState(card);
  const cardWithLocalRelated = useMemo(
    () => ({ ...card, related }),
    [card, related],
  );

  const trigger = (
    <AnglesTrigger
      hasRelated={hasRelated}
      generating={generating}
      isOpen={openRail}
      onToggle={() => setOpenRail((v) => !v)}
      onGenerate={async () => {
        const ok = await generate();
        if (ok) setOpenRail(true);
      }}
    />
  );

  return (
    <article className="relative flex h-full flex-col">
      <CardChrome
        card={card}
        size="sm"
        isRead={isRead}
        isDiscussed={isDiscussed}
        onDiscussClick={onMarkDiscussed}
        onImageClick={onMarkRead}
        rightSlot={trigger}
      />
      {openRail && hasRelated && (
        <ThreeAnglesPanel card={cardWithLocalRelated} layout="below" />
      )}
    </article>
  );
}

export function ThisWeek({ cards }: { cards: ThisWeekCardData[] }) {
  const [readIds, setReadIds] = useState<Set<string>>(
    () => new Set(cards.filter((c) => c.is_read).map((c) => c.id)),
  );
  const [discussedIds, setDiscussedIds] = useState<Set<string>>(
    () => new Set(cards.filter((c) => c.is_discussed).map((c) => c.id)),
  );

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
    // Claude を押した時点で「読んだ」も同時に立てる(対話 = 触れた)
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (discussedIds.has(id)) {
      // 既に対話済みでも Claude を再度開きたいニーズはあるので onClick は通すが
      // サーバ更新は冪等化のため抑える(タイムスタンプを上書きしない)
      return;
    }
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

  if (cards.length === 0) return null;

  const sorted = [...cards].sort(
    (a, b) => b.significance_score - a.significance_score,
  );

  // 1記事: フルワイド LARGE。3 Angles はカード下に展開
  if (sorted.length === 1) {
    const c = sorted[0];
    return (
      <section className="px-14 pt-7">
        <HeroCard
          card={c}
          isRead={readIds.has(c.id)}
          isDiscussed={discussedIds.has(c.id)}
          onMarkRead={() => recordRead(c.id)}
          onMarkDiscussed={() => recordDiscussed(c.id)}
          railPlacement="below"
        />
      </section>
    );
  }

  // 2記事: LARGE × 2 を等幅で横並び。3 Angles は各カード下に展開
  if (sorted.length === 2) {
    return (
      <section className="grid grid-cols-2 items-start gap-10 px-14 pt-7">
        {sorted.map((c) => (
          <HeroCard
            key={c.id}
            card={c}
            isRead={readIds.has(c.id)}
            isDiscussed={discussedIds.has(c.id)}
            onMarkRead={() => recordRead(c.id)}
            onMarkDiscussed={() => recordDiscussed(c.id)}
            railPlacement="below"
          />
        ))}
      </section>
    );
  }

  // 3記事: LARGE (左 1.2fr) + SMALL × 2 (右 1fr 縦積み)、3 Angles はサイドレール
  const [hero, ...rest] = sorted;
  return (
    <section className="grid grid-cols-[1.2fr_1fr] gap-10 px-14 pt-7">
      <div className="relative">
        <HeroCard
          card={hero}
          isRead={readIds.has(hero.id)}
          isDiscussed={discussedIds.has(hero.id)}
          onMarkRead={() => recordRead(hero.id)}
          onMarkDiscussed={() => recordDiscussed(hero.id)}
        />
      </div>
      <div className="flex flex-col gap-10">
        {rest.map((c) => (
          <SmallCard
            key={c.id}
            card={c}
            isRead={readIds.has(c.id)}
            isDiscussed={discussedIds.has(c.id)}
            onMarkRead={() => recordRead(c.id)}
            onMarkDiscussed={() => recordDiscussed(c.id)}
          />
        ))}
      </div>
    </section>
  );
}
