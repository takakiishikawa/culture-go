import Anthropic from "@anthropic-ai/sdk";
import type { CulturegoClient } from "@/lib/supabase/types";
import { fetchOgImage, fetchUnsplashImage } from "./extract-image";
import { isPaywallUrl, PAYWALL_HINT_FOR_PROMPT } from "./paywall-domains";
import {
  SIGNIFICANCE_THRESHOLD,
  computeSignificance,
  loadDimensions,
  type ScoringDimension,
} from "./dimensions";

interface Candidate {
  title: string;
  summary: string;
  why_important: string;
  source_urls: string[];
  scope: "world" | "japan" | "vietnam";
  keywords?: string[];
  tags?: string[];
  related_articles?: { title: string; url: string }[];
  image_query?: string; // Unsplash フォールバック用 (英語 2-4 語)
  scores: Record<string, number>; // dim_1, dim_2, ...
  published_at?: string;
}

export interface DetectionSummary {
  candidatesGenerated: number;
  inserted: number;
  skippedBelowThreshold: number;
  skippedOverWeeklyCap: number;
  insertedCardIds: string[];
  errors: string[];
}

// editorial 哲学: 週に最大 3 件まで。瑣末を増やさない。
const WEEKLY_INSERT_CAP = 3;

/**
 * mode:
 *  - "full": Sonnet 4.6 + web search 8 回 / 候補 8 件 / 16k tokens。cron で実行する想定。
 *  - "fast": Haiku 4.5 + web search 3 回 / 候補 4 件 / 6k tokens。Vercel Hobby の
 *           60s 制限内で in-app verification ボタン用。
 */
export type DetectionMode = "full" | "fast";

interface DetectionConfig {
  model: string;
  maxWebSearches: number;
  maxCandidates: number;
  maxTokens: number;
}

const CONFIGS: Record<DetectionMode, DetectionConfig> = {
  full: {
    model: "claude-sonnet-4-6",
    maxWebSearches: 8,
    maxCandidates: 8,
    maxTokens: 16000,
  },
  fast: {
    model: "claude-haiku-4-5-20251001",
    maxWebSearches: 3,
    maxCandidates: 4,
    maxTokens: 6000,
  },
};

export async function runDetection(
  sb: CulturegoClient,
  opts: { lookbackDays?: number; mode?: DetectionMode } = {},
): Promise<DetectionSummary> {
  const lookback = opts.lookbackDays ?? 7;
  const cfg = CONFIGS[opts.mode ?? "full"];
  const anthropic = new Anthropic();

  const [{ data: tagRows }, dimensions] = await Promise.all([
    sb.from("tags").select("name").order("display_order", { ascending: true }),
    loadDimensions(sb),
  ]);
  const tagNames = (tagRows ?? []).map((t) => t.name);

  const dimensionDescriptions = dimensions
    .map(
      (d, i) =>
        `- dim_${i + 1} (label: ${d.label}, weight: ${d.weight}): ${d.description}\n  rubric: ${d.rubric}`,
    )
    .join("\n");

  const systemPrompt = `あなたは "culturego" という週刊スローメディアの編集者です。世界の進む方向を変えうる本質的な構造シフトだけを選び抜きます。瑣末なニュースは絶対に含めない。

スコアは以下の ${dimensions.length} 軸を 0–10 で採点し、重み付き和で 0–10 のスコアを出します:
${dimensionDescriptions}

しきい値: 重み付き総合スコアが ${SIGNIFICANCE_THRESHOLD} 未満のものは publish せず、それ以上のものだけを返してください。ただしリストには候補として全て含めて構いません（こちらでフィルタします）。

特に "構造的変化"（力学が変わるか）の評価を厳格に行うこと。これがこのメディアの核です。

ソース選定の制約（重要）:
- ペイウォール / 部分閲覧専用の主要サイト (${PAYWALL_HINT_FOR_PROMPT} 等) を一次ソースに置かない。本文が読者に閲覧できないため。
- 優先順位: 一次ソース (政府発表 / 企業 IR / 学術論文 / 公式 PR) → 無料公開のニュース通信社 (Reuters, AP, BBC, NHK, 朝日 通常記事, AFP) → 信頼性の高い解説媒体の無料記事。
- 同じ事象を扱う複数ソースがある場合、ペイウォール無しを選ぶこと。

ユーザーの興味タグ（このタグに合致するものを優先するが、これらに限らず本当に大きい出来事は含める）: ${tagNames.join("、") || "（未設定）"}`;

  const userPrompt = `直近 ${lookback} 日の世界・日本・ベトナムから、世界の進む方向を変えうる構造シフトを最大 ${cfg.maxCandidates} 件まで挙げ、各候補に ${dimensions.length} 軸スコアを付けて submit_candidates ツールで提出してください。

各候補について:
- title: 一文で本質を捉える（30 字以内）
- summary: 何が起きたか（120–200 字）
- why_important: なぜ世界の方向に効くか（120–200 字、Stratechery 風の構造的視点）
- source_urls: 一次〜信頼できる二次ソースの URL（複数）
- scope: world / japan / vietnam
- keywords: 5–10 の検索可能キーワード
- tags: ユーザータグから合致するもの（無くてよい）
- image_query: 英語 2–4 語の象徴的キーワード (記事に画像が無かった時の代替写真検索用)。固有名詞より象徴語: 例 "federal reserve building", "tokyo diet chamber", "hanoi street market", "semiconductor wafer", "container ship port"
- scores: ${dimensions.map((_, i) => `dim_${i + 1}`).join(", ")} を 0–10 で
- published_at: 出来事の発生日 (ISO8601)`;

  type ToolDef = Anthropic.Messages.Tool;

  const scoresProperties: Record<
    string,
    {
      type: "number";
      minimum: number;
      maximum: number;
      description: string;
    }
  > = {};
  const scoresRequired: string[] = [];
  dimensions.forEach((d, i) => {
    const key = `dim_${i + 1}`;
    scoresProperties[key] = {
      type: "number",
      minimum: 0,
      maximum: 10,
      description: `${d.label}: ${d.description} (採点基準: ${d.rubric})`,
    };
    scoresRequired.push(key);
  });

  const tools: ToolDef[] = [
    {
      name: "submit_candidates",
      description: "検出した候補をスコア付きで提出する",
      input_schema: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                why_important: { type: "string" },
                source_urls: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
                scope: {
                  type: "string",
                  enum: ["world", "japan", "vietnam"],
                },
                keywords: { type: "array", items: { type: "string" } },
                tags: { type: "array", items: { type: "string" } },
                related_articles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string", format: "uri" },
                    },
                    required: ["title", "url"],
                  },
                },
                image_query: {
                  type: "string",
                  description:
                    "英語 2-4 語の象徴的キーワード。og:image が無い時の Unsplash 検索用 (例: 'federal reserve building', 'container ship port')",
                },
                scores: {
                  type: "object",
                  properties: scoresProperties,
                  required: scoresRequired,
                },
                published_at: { type: "string", format: "date-time" },
              },
              required: [
                "title",
                "summary",
                "why_important",
                "source_urls",
                "scope",
                "scores",
              ],
            },
          },
        },
        required: ["candidates"],
      },
    },
  ];

  const allTools = [
    ...tools,
    {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: cfg.maxWebSearches,
    },
  ] as unknown as ToolDef[];

  const message = await anthropic.messages.create({
    model: cfg.model,
    max_tokens: cfg.maxTokens,
    system: systemPrompt,
    tools: allTools,
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: userPrompt }],
  });

  const submission = message.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock =>
      b.type === "tool_use" && b.name === "submit_candidates",
  );
  if (!submission) {
    throw new Error("検出ツールの呼び出しが返されませんでした");
  }

  const rawCandidates = (submission.input as { candidates: Candidate[] })
    .candidates;

  // ペイウォール一次ソースを後段でも防御 (Claude のミス保険)。
  // source_urls から paywall を除外、結果として空になる候補は drop。
  const candidates: Candidate[] = [];
  let droppedPaywall = 0;
  for (const c of rawCandidates) {
    const filteredUrls = (c.source_urls ?? []).filter(
      (u) => !isPaywallUrl(u),
    );
    if (filteredUrls.length === 0) {
      droppedPaywall += 1;
      continue;
    }
    candidates.push({ ...c, source_urls: filteredUrls });
  }

  const summary: DetectionSummary = {
    candidatesGenerated: candidates.length,
    inserted: 0,
    skippedBelowThreshold: 0,
    skippedOverWeeklyCap: 0,
    insertedCardIds: [],
    errors: [],
  };
  if (droppedPaywall > 0) {
    summary.errors.push(
      `dropped ${droppedPaywall} paywall-only candidate(s) post-filter`,
    );
  }

  const { data: allTags } = await sb.from("tags").select("id, name");
  const tagIdByName = new Map(
    (allTags ?? []).map((t) => [t.name, t.id as string]),
  );

  // 候補ごとに significance を計算し、閾値通過分だけを取り出す。
  type Scored = { candidate: Candidate; score: number; index: number };
  const scored: Scored[] = candidates.map((c, i) => ({
    candidate: c,
    score: computeSignificance(dimensions, c.scores),
    index: i,
  }));

  const passing: Scored[] = [];
  for (const s of scored) {
    if (s.score < SIGNIFICANCE_THRESHOLD) {
      summary.skippedBelowThreshold += 1;
      continue;
    }
    passing.push(s);
  }

  // 週次キャップ: 通過分を significance 降順で上位 N 件のみ insert 対象に。
  passing.sort((a, b) => b.score - a.score);
  const insertTargets = passing.slice(0, WEEKLY_INSERT_CAP);
  summary.skippedOverWeeklyCap = passing.length - insertTargets.length;

  // 画像取得: insert 対象の候補についてのみ og:image → Unsplash フォールバック。
  // (drop する分の HTTP / Unsplash クォータを無駄にしない)
  const ogImages = await Promise.all(
    insertTargets.map((s) =>
      s.candidate.source_urls?.[0]
        ? fetchOgImage(s.candidate.source_urls[0])
        : Promise.resolve(null),
    ),
  );
  const heroImages = await Promise.all(
    insertTargets.map(async (s, i) => {
      if (ogImages[i]) return ogImages[i];
      const query = s.candidate.image_query?.trim();
      if (!query) return null;
      return await fetchUnsplashImage(query);
    }),
  );

  for (let i = 0; i < insertTargets.length; i++) {
    const { candidate: c, score } = insertTargets[i];

    const { data: card, error } = await sb
      .from("cards")
      .insert({
        title: c.title,
        summary: c.summary,
        why_important: c.why_important,
        source_urls: c.source_urls,
        hero_image_url: heroImages[i],
        scope: c.scope,
        keywords: c.keywords ?? [],
        related_articles: c.related_articles ?? [],
        significance_score: score,
        published_at: c.published_at ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !card) {
      summary.errors.push(error?.message ?? "insert returned no row");
      continue;
    }

    if (c.tags?.length) {
      const cardTagRows = c.tags
        .map((name) => tagIdByName.get(name))
        .filter((id): id is string => Boolean(id))
        .map((tag_id) => ({ card_id: card.id, tag_id }));
      if (cardTagRows.length > 0) {
        await sb.from("card_tags").insert(cardTagRows);
      }
    }

    summary.inserted += 1;
    summary.insertedCardIds.push(card.id);
  }

  return summary;
}

export type { ScoringDimension };
