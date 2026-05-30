import Anthropic from "@anthropic-ai/sdk";
import type { CulturegoClient } from "@/lib/supabase/types";
import { fetchOgImage, fetchUnsplashImage } from "./extract-image";
import { isPaywallUrl, PAYWALL_HINT_FOR_PROMPT } from "./paywall-domains";

// サイゴン・リビング検出。
// Shift（旧 hcmc）が「動き / 変化 / 告知」を扱うのに対し、Living は
// 「暮らしのテクスチャ」を扱う。場所・人・習慣の物語が立ち上がるか。
// 3軸スコア:
//   story_depth (0.45)        : 場所/人/場面の固有性。抽象解説・統計まとめは低い
//   everyday_intimacy (0.40)  : 読み手の生活からの距離（明日試せる / 歩いて行ける）
//   reliability (0.15)        : 情報源の確度。住人視点の一次記録には寛容
interface LivingCandidate {
  title: string;
  summary: string;
  why_useful: string;
  source_urls: string[];
  living_kind: "place" | "person" | "ritual";
  keywords?: string[];
  image_query?: string;
  scores: {
    story_depth: number;
    everyday_intimacy: number;
    reliability: number;
  };
  published_at?: string;
}

export interface LivingDetectionSummary {
  candidatesGenerated: number;
  inserted: number;
  skippedBelowThreshold: number;
  skippedLowReliability: number;
  skippedOverWeeklyCap: number;
  skippedDuplicate: number;
  insertedCardIds: string[];
  errors: string[];
}

// editorial: 週 3 件まで。
const WEEKLY_INSERT_CAP = 3;
// 総合スコアの最低値。Shift より高めに振って鋭さを担保。
const LIVING_THRESHOLD = 6.8;
// 信頼性 floor。匿名 / 個人ブログを弾く（住人視点エッセイは 5+ を期待）。
const LIVING_RELIABILITY_MIN = 5;
// 過去 4 週間の Living カードと keywords が Jaccard 0.5 以上ならスコア -1.0。
const DEDUP_LOOKBACK_DAYS = 28;
const DEDUP_JACCARD = 0.5;
const DEDUP_PENALTY = 1.0;

export type LivingDetectionMode = "full" | "fast";

interface LivingConfig {
  model: string;
  maxWebSearches: number;
  maxCandidates: number;
  maxTokens: number;
}

const CONFIGS: Record<LivingDetectionMode, LivingConfig> = {
  full: {
    model: "claude-sonnet-4-6",
    maxWebSearches: 10,
    maxCandidates: 8,
    maxTokens: 12000,
  },
  fast: {
    model: "claude-haiku-4-5-20251001",
    maxWebSearches: 5,
    maxCandidates: 5,
    maxTokens: 6000,
  },
};

function computeLivingScore(s: LivingCandidate["scores"]): number {
  const raw =
    0.45 * (s.story_depth ?? 0) +
    0.4 * (s.everyday_intimacy ?? 0) +
    0.15 * (s.reliability ?? 0);
  return Math.round(raw * 10) / 10;
}

function normalizeKeyword(k: string): string {
  return k.trim().toLowerCase();
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function runLivingDetection(
  sb: CulturegoClient,
  opts: {
    lookbackDays?: number;
    mode?: LivingDetectionMode;
    // 候補が published_at を返さなかった場合のフォールバック日付。
    // 週バックフィル用途 (例: 2026-05-10 週分を埋める) で使う。
    fallbackPublishedAt?: string;
    // 指定すると candidate 側の日付を無視して全カードをこの日付で insert。
    // 週バックフィル用途で、特定週に必ず載せたい時に使う。
    overridePublishedAt?: string;
  } = {},
): Promise<LivingDetectionSummary> {
  const lookback = opts.lookbackDays ?? 45;
  const cfg = CONFIGS[opts.mode ?? "full"];
  const anthropic = new Anthropic();

  const systemPrompt = `あなたは "culturego" の「サイゴン・リビング」担当編集者です。ホーチミン市（サイゴン）で暮らす人に向けて、週1で「今ここで暮らしている肌感覚」を切り取ります。

このコーナーが扱うのは "出来事" ではなく "状態 / テクスチャ" です。場所・人・習慣の固有の物語が立ち上がる記事だけを選ぶこと。Stratechery や Air Mail のような海外メディアトーンで、編集物としての品位を持たせる。

選定の 3 種類（必ずいずれかに分類する）:
- place（場所）: 特定のカフェ・市場・路地・川沿い・商店など、地理的に固有な場所の物語
- person（人）: 街で生きる特定の人物・職人・店主・コミュニティの物語
- ritual（習慣）: 朝のコーヒー、夕方のバインミー、月見、雨季のリズムなど、繰り返される暮らしの振る舞い

【絶対に扱わないもの（front-load で除外する）】:
- 災害・事故・治安・犯罪
- 法令・規制・行政発表・政治
- インフレ・物価変動ニュース、「X% 増 / N 位にランクイン」型のランキング・統計
- インフラ停止・公共サービス障害
- 単発の新店オープン / 閉店 / セール告知（イベント性が主のもの）
- これらは Saigon Shift で扱われるため、Living では一切採用しない

【許可される観察型エッセイの例】:
- 「サイゴンのカフェ文化はこういう形で根付いてきた」という観察記事
- 「ベンタイン市場の朝に流れる時間」という場の描写
- 「バインミー職人がパンを焼く工程」という人物の物語
- 「雨季のホーチミンに刻まれる暮らしのリズム」というルーティンの描写

ソース選定:
- 主軸: Saigoneer, Vietcetera, VnExpress International の Trend / Travel / Life セクション, Vietnam Insider Culture
- 補助: ローカル料理・コーヒー・市場の取材ブログ（記名・複数記事のある媒体に限定）
- 不可: ペイウォール (${PAYWALL_HINT_FOR_PROMPT} 等) / 匿名ブログ / アフィリエイト記事 / 旅行会社の販促記事 / wordpress 個人 / note.com 個人
- 住人視点の一次記録は寛容に扱う（reliability 5 相当を許可）。ただし匿名は不可。
- 必ず実在する公開 URL のみを使う。AI が要約した架空の記事を捏造しない。`;

  const userPrompt = `直近 ${lookback} 日のホーチミン市（サイゴン）周辺から、暮らしのテクスチャを最大 ${cfg.maxCandidates} 件まで挙げ、各候補に 3 軸スコアを付けて submit_living_candidates ツールで提出してください。

各候補について:
- title: 暮らしの一場面を捉える日本語の見出し（30 字以内）。事件性のある語（"危機"、"急増"、"発表"、"規制" 等）は使わない。
- summary: 何の物語か（120–200 字、日本語）
- why_useful: なぜ今これを読むと暮らしの肌触りが立ち上がるか（120–200 字、日本語）
- source_urls: 実在する公開 URL（複数可）
- living_kind: place / person / ritual のいずれか
- keywords: 3–8 の検索可能キーワード（**全て英語・小文字・1–3 語のフレーズ**。例: "saigon cafe", "ben thanh morning", "banh mi craft"）
- image_query: 英語 2–4 語の象徴的キーワード（og:image が無かった時の代替写真検索用。例 "saigon alley morning", "vietnam coffee filter"）
- scores: 以下 3 軸を 0–10 で
    * story_depth: 場所/人/場面の固有性。抽象解説・統計まとめ・「Vietnam ranks 〇〇」型は 0–3。特定の店・人・路地が立ち上がる物語は 7+
    * everyday_intimacy: 読み手の生活からの距離。「明日歩いて行ける / 隣人がやっている / 自分も真似できる」近さ。観念的な解説は 0–3、具体的生活描写は 7+
    * reliability: 0=匿名 / 5=住人視点の記名記録 or ローカル媒体 / 7=Saigoneer / Vietcetera / VnExpress 等の編集記事 / 9=複数編集記事の照合
- published_at: 記事公開日（ISO8601）

総合スコア（0.45 × story_depth + 0.40 × everyday_intimacy + 0.15 × reliability）が ${LIVING_THRESHOLD} 未満の弱い候補は無理に挙げない（ゼロ件でも構わない）。`;

  type ToolDef = Anthropic.Messages.Tool;

  const tools: ToolDef[] = [
    {
      name: "submit_living_candidates",
      description: "検出したサイゴン・リビングの候補を 3 軸スコア付きで提出する",
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
                why_useful: { type: "string" },
                source_urls: {
                  type: "array",
                  items: { type: "string", format: "uri" },
                },
                living_kind: {
                  type: "string",
                  enum: ["place", "person", "ritual"],
                },
                keywords: { type: "array", items: { type: "string" } },
                image_query: {
                  type: "string",
                  description:
                    "英語 2-4 語の象徴的キーワード。og:image が無い時の Unsplash 検索用",
                },
                scores: {
                  type: "object",
                  properties: {
                    story_depth: {
                      type: "number",
                      minimum: 0,
                      maximum: 10,
                      description:
                        "場所/人/場面の固有性。抽象・統計は低く、特定の店・人・路地が立ち上がる物語は高く",
                    },
                    everyday_intimacy: {
                      type: "number",
                      minimum: 0,
                      maximum: 10,
                      description:
                        "読み手の生活からの距離。明日歩いて行ける / 真似できる近さ",
                    },
                    reliability: {
                      type: "number",
                      minimum: 0,
                      maximum: 10,
                      description:
                        "情報源の確度。住人視点の一次記録に寛容（5+）",
                    },
                  },
                  required: ["story_depth", "everyday_intimacy", "reliability"],
                },
                published_at: { type: "string", format: "date-time" },
              },
              required: [
                "title",
                "summary",
                "why_useful",
                "source_urls",
                "living_kind",
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
      b.type === "tool_use" && b.name === "submit_living_candidates",
  );
  if (!submission) {
    throw new Error("検出ツールの呼び出しが返されませんでした");
  }

  const rawCandidates = (submission.input as { candidates: LivingCandidate[] })
    .candidates;

  // ペイウォール一次ソース後段防御。
  const candidates: LivingCandidate[] = [];
  let droppedPaywall = 0;
  for (const c of rawCandidates) {
    const filteredUrls = (c.source_urls ?? []).filter((u) => !isPaywallUrl(u));
    if (filteredUrls.length === 0) {
      droppedPaywall += 1;
      continue;
    }
    candidates.push({ ...c, source_urls: filteredUrls });
  }

  const summary: LivingDetectionSummary = {
    candidatesGenerated: candidates.length,
    inserted: 0,
    skippedBelowThreshold: 0,
    skippedLowReliability: 0,
    skippedOverWeeklyCap: 0,
    skippedDuplicate: 0,
    insertedCardIds: [],
    errors: [],
  };
  if (droppedPaywall > 0) {
    summary.errors.push(
      `dropped ${droppedPaywall} paywall-only candidate(s) post-filter`,
    );
  }

  // 過去 4 週の Living カードの keywords を取得し、Jaccard で重複ペナルティ。
  const dedupCutoff = new Date(
    Date.now() - DEDUP_LOOKBACK_DAYS * 86_400_000,
  ).toISOString();
  const { data: pastCards } = await sb
    .from("cards")
    .select("keywords")
    .eq("channel", "hcmc_living")
    .gte("published_at", dedupCutoff);
  const pastKeywordSets: Set<string>[] = (pastCards ?? []).map(
    (row) =>
      new Set(((row.keywords as string[] | null) ?? []).map(normalizeKeyword)),
  );

  type Scored = { candidate: LivingCandidate; score: number };
  const passing: Scored[] = [];
  for (const c of candidates) {
    let score = computeLivingScore(c.scores);

    // 重複ペナルティ
    const candidateKw = new Set((c.keywords ?? []).map(normalizeKeyword));
    const maxJaccard = pastKeywordSets.reduce(
      (m, past) => Math.max(m, jaccard(candidateKw, past)),
      0,
    );
    if (maxJaccard >= DEDUP_JACCARD) {
      score = Math.round((score - DEDUP_PENALTY) * 10) / 10;
      summary.skippedDuplicate += 1;
    }

    if (score < LIVING_THRESHOLD) {
      summary.skippedBelowThreshold += 1;
      continue;
    }
    if ((c.scores?.reliability ?? 0) < LIVING_RELIABILITY_MIN) {
      summary.skippedLowReliability += 1;
      continue;
    }
    passing.push({ candidate: c, score });
  }

  passing.sort((a, b) => b.score - a.score);
  const insertTargets = passing.slice(0, WEEKLY_INSERT_CAP);
  summary.skippedOverWeeklyCap = passing.length - insertTargets.length;

  // 画像取得
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
        why_important: c.why_useful,
        source_urls: c.source_urls,
        hero_image_url: heroImages[i],
        scope: "vietnam",
        channel: "hcmc_living",
        living_kind: c.living_kind,
        keywords: c.keywords ?? [],
        related_articles: [],
        significance_score: score,
        published_at:
          opts.overridePublishedAt ??
          c.published_at ??
          opts.fallbackPublishedAt ??
          new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error || !card) {
      summary.errors.push(error?.message ?? "insert returned no row");
      continue;
    }

    summary.inserted += 1;
    summary.insertedCardIds.push(card.id);
  }

  return summary;
}
