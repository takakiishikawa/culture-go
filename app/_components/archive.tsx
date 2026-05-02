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

export interface ArchiveCardData {
  id: string;
  title: string;
  scope: "world" | "japan" | "vietnam";
  keywords: string[];
  significance_score: number;
  source_urls: string[];
  is_read: boolean;
  read_at: string | null;
}

export interface ArchiveWeek {
  weekLabel: string;
  issueNumber?: number;
  cards: ArchiveCardData[];
}

function ScopeTag({ scope }: { scope: ArchiveCardData["scope"] }) {
  const c = SCOPE_COLOR[scope];
  return (
    <span
      className="inline-flex items-center text-[10.5px] font-bold uppercase tracking-[0.32em]"
      style={{ color: c }}
    >
      {SCOPE_LABEL[scope]}
    </span>
  );
}

function KeywordRow({ items, color }: { items: string[]; color: string }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.24em]"
      style={{ color }}
    >
      {items.map((k, i) => (
        <span key={k} className="inline-flex items-center gap-3">
          <span>{k}</span>
          {i < items.length - 1 && <span className="opacity-40">·</span>}
        </span>
      ))}
    </div>
  );
}

export function Archive({ weeks }: { weeks: ArchiveWeek[] }) {
  if (weeks.length === 0) return null;

  return (
    <section className="px-16 pb-24">
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
            const dim = card.is_read;
            const titleColor = dim ? "#999" : "#1A1A1A";
            const keywordColor = dim ? "#bbb" : "#999";
            const isFirst = wIdx === 0 && cIdx === 0;
            return (
              <a
                key={card.id}
                href={card.source_urls[0]}
                target="_blank"
                rel="noreferrer"
                className="grid items-center gap-6 py-4 pl-3"
                style={{
                  gridTemplateColumns: "100px 60px 1fr 200px 110px 32px",
                  borderTop: isFirst ? "none" : "1px solid #F0F0F0",
                }}
              >
                <ScopeTag scope={card.scope} />
                <span
                  className="cg-num text-[22px] font-light"
                  style={{ color: titleColor, letterSpacing: "-0.03em" }}
                >
                  {card.significance_score.toFixed(1)}
                </span>
                <span
                  className="text-base font-medium"
                  style={{
                    color: titleColor,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {card.title}
                </span>
                <KeywordRow items={card.keywords} color={keywordColor} />
                <span className="text-[10px] uppercase italic tracking-[0.16em] text-[#bbb]">
                  {dim && card.read_at ? `read ${card.read_at}` : ""}
                </span>
                <span className="text-base text-[#999]">→</span>
              </a>
            );
          })}
        </div>
      ))}
    </section>
  );
}
