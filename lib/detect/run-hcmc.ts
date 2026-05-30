import Anthropic from "@anthropic-ai/sdk";
import type { CulturegoClient } from "@/lib/supabase/types";
import { fetchOgImage, fetchUnsplashImage } from "./extract-image";
import { isPaywallUrl, PAYWALL_HINT_FOR_PROMPT } from "./paywall-domains";

// サイゴン・シフト検出（DB の channel 値は歴史的に "hcmc" のまま）。
// global の「世界の構造シフト」とは評価軸が別物: ここは「ホーチミンで暮らす上で
// 役立つか（practical / 実用）」「会話のネタになる面白さがあるか（trivia / 小ネタ）」で選ぶ。
// 暮らしのテクスチャ（場所・人・習慣）は別チャンネル hcmc_living = サイゴン・リビングで扱う。
interface HcmcCandidate {
  title: string;
  summary: string;
  why_useful: string; // なぜ知っておくと良いか / なぜ面白いか
  source_urls: string[];
  hcmc_kind: "practical" | "trivia";
  keywords?: string[];
  image_query?: string; // Unsplash フォールバック用 (英語 2-4 語)
  value_score: number; // 0-10。practical=実用度 / trivia=面白さ
  reliability: number; // 0-10。情報源の確度
  published_at?: string;
}

export interface HcmcDetectionSummary {
  candidatesGenerated: number;
  inserted: number;
  skippedBelowThreshold: number;
  skippedLowReliability: number;
  skippedOverWeeklyCap: number;
  insertedCardIds: string[];
  errors: string[];
}

// editorial 哲学: 週に最大 3 件。ローカルでも瑣末は増やさない。
const WEEKLY_INSERT_CAP = 3;
// 実用 / 面白さ いずれかの主軸スコアの最低値。global (7.0) より低いのは
// 「構造シフト」ではなく「生活実感に効く / ネタになる」を測る軸のため。
const HCMC_THRESHOLD = 6.0;
// 情報源の確度 floor。個人ブログ・匿名サイトを弾く。
const HCMC_RELIABILITY_MIN = 4;

export type HcmcDetectionMode = "full" | "fast";

interface HcmcConfig {
  model: string;
  maxWebSearches: number;
  maxCandidates: number;
  maxTokens: number;
}

const CONFIGS: Record<HcmcDetectionMode, HcmcConfig> = {
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

export async function runHcmcDetection(
  sb: CulturegoClient,
  opts: { lookbackDays?: number; mode?: HcmcDetectionMode } = {},
): Promise<HcmcDetectionSummary> {
  const lookback = opts.lookbackDays ?? 7;
  const cfg = CONFIGS[opts.mode ?? "full"];
  const anthropic = new Anthropic();

  const systemPrompt = `あなたは "culturego" の「サイゴン・シフト」担当編集者です。ホーチミン市（サイゴン）で暮らす人に向けて、週1で街の「動き・変化・告知」を選び抜きます。

選定基準は次の 2 種類のいずれか:
- practical（実用）: ホーチミンで生活する上で知っておくと役立つこと。行政・制度・物価・交通・インフラ・治安・天候・営業/休業・新店や閉店・大型イベントの開催情報など、生活判断に効くもの。
- trivia（小ネタ）: 会話のネタになる、面白い・楽しい・意外なローカルの話題。食・文化・街の出来事・流行・歴史こぼれ話など。

ここは「世界の構造シフト」を選ぶコーナーではありません。あくまでローカルで、暮らしに役立つか／話して面白いかだけで選ぶこと。瑣末に見えても生活実感に効く・ネタになるなら採ってよい。逆に、ホーチミン在住者の生活・会話と関係の薄いものは外す。日本・世界の大きなニュースはここでは扱わない。

なお、暮らしの "状態 / テクスチャ"（特定の場所・人・習慣の物語）は別チャンネルの「サイゴン・リビング」が担当する。Shift は "動いたこと / 変わったこと" だけを扱うこと。

ソース選定:
- 優先: VnExpress International (e.vnexpress.net), Tuoi Tre News, Thanh Nien, Vietnam News, Saigoneer, ベトナム政府・ホーチミン市当局の公式発表, Reuters / AP のベトナム関連記事。
- 不可: ペイウォール (${PAYWALL_HINT_FOR_PROMPT} 等) / 個人ブログ / wordpress 個人 / note.com 個人 / 匿名サイト / アフィリエイト記事。
- 必ず実在する公開 URL のみを使う。AI が要約した架空の記事を捏造しない。`;

  const userPrompt = `直近 ${lookback} 日のホーチミン市（サイゴン）周辺から、ローカルな話題を最大 ${cfg.maxCandidates} 件まで挙げ、各候補にスコアを付けて submit_hcmc_candidates ツールで提出してください。

各候補について:
- title: 話題の核を一文で捉える日本語の見出し（30 字以内）
- summary: 何の話題か（120–200 字、日本語）
- why_useful: なぜ知っておくと良いか / なぜ面白いかを一段深く（120–200 字、日本語）
- source_urls: 実在する公開 URL（複数可）
- hcmc_kind: practical（実用）か trivia（小ネタ）か
- keywords: 3–8 の検索可能キーワード（**全て英語・小文字・1–3 語のフレーズ**。例: "ben thanh market", "metro line 1", "street food"）
- image_query: 英語 2–4 語の象徴的キーワード（og:image が無かった時の代替写真検索用。例 "saigon street food", "ben thanh market", "ho chi minh city skyline", "motorbike traffic saigon"）
- value_score: 0–10。practical なら「ホーチミン生活での実用度」、trivia なら「ネタとしての面白さ・意外性」を採点する
- reliability: 0–10（0=個人ブログ・匿名 / 4=ローカル報道機関 / 7=主要報道機関または複数ソース / 9=公式発表+独立検証）
- published_at: 話題の発生日（ISO8601）

value_score が ${HCMC_THRESHOLD} 未満の弱い話題は無理に挙げない（ゼロ件でも構わない）。`;

  type ToolDef = Anthropic.Messages.Tool;

  const tools: ToolDef[] = [
    {
      name: "submit_hcmc_candidates",
      description: "検出したサイゴン・シフト（動き・変化・告知）の候補をスコア付きで提出する",
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
                hcmc_kind: {
                  type: "string",
                  enum: ["practical", "trivia"],
                },
                keywords: { type: "array", items: { type: "string" } },
                image_query: {
                  type: "string",
                  description:
                    "英語 2-4 語の象徴的キーワード。og:image が無い時の Unsplash 検索用",
                },
                value_score: {
                  type: "number",
                  minimum: 0,
                  maximum: 10,
                  description:
                    "practical なら実用度、trivia なら面白さ・意外性を 0-10 で",
                },
                reliability: {
                  type: "number",
                  minimum: 0,
                  maximum: 10,
                  description: "情報源の確度を 0-10 で",
                },
                published_at: { type: "string", format: "date-time" },
              },
              required: [
                "title",
                "summary",
                "why_useful",
                "source_urls",
                "hcmc_kind",
                "value_score",
                "reliability",
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
      b.type === "tool_use" && b.name === "submit_hcmc_candidates",
  );
  if (!submission) {
    throw new Error("検出ツールの呼び出しが返されませんでした");
  }

  const rawCandidates = (submission.input as { candidates: HcmcCandidate[] })
    .candidates;

  // ペイウォール一次ソースを後段でも防御。source_urls から paywall を除外、
  // 結果として空になる候補は drop。
  const candidates: HcmcCandidate[] = [];
  let droppedPaywall = 0;
  for (const c of rawCandidates) {
    const filteredUrls = (c.source_urls ?? []).filter((u) => !isPaywallUrl(u));
    if (filteredUrls.length === 0) {
      droppedPaywall += 1;
      continue;
    }
    candidates.push({ ...c, source_urls: filteredUrls });
  }

  const summary: HcmcDetectionSummary = {
    candidatesGenerated: candidates.length,
    inserted: 0,
    skippedBelowThreshold: 0,
    skippedLowReliability: 0,
    skippedOverWeeklyCap: 0,
    insertedCardIds: [],
    errors: [],
  };
  if (droppedPaywall > 0) {
    summary.errors.push(
      `dropped ${droppedPaywall} paywall-only candidate(s) post-filter`,
    );
  }

  // value_score（実用 or 面白さの主軸）でフィルタ → reliability floor → 週次キャップ
  type Scored = { candidate: HcmcCandidate; score: number };
  const passing: Scored[] = [];
  for (const c of candidates) {
    const score = Math.round((c.value_score ?? 0) * 10) / 10;
    if (score < HCMC_THRESHOLD) {
      summary.skippedBelowThreshold += 1;
      continue;
    }
    if ((c.reliability ?? 0) < HCMC_RELIABILITY_MIN) {
      summary.skippedLowReliability += 1;
      continue;
    }
    passing.push({ candidate: c, score });
  }

  passing.sort((a, b) => b.score - a.score);
  const insertTargets = passing.slice(0, WEEKLY_INSERT_CAP);
  summary.skippedOverWeeklyCap = passing.length - insertTargets.length;

  // 画像取得: insert 対象のみ og:image → Unsplash フォールバック
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
        // scope は NOT NULL CHECK のため vietnam を入れる（HCMC はベトナム内）。
        // 一覧の出し分けは channel で行う。バッジは hcmc_kind を使う。
        scope: "vietnam",
        channel: "hcmc",
        hcmc_kind: c.hcmc_kind,
        keywords: c.keywords ?? [],
        related_articles: [],
        significance_score: score,
        published_at: c.published_at ?? new Date().toISOString(),
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
