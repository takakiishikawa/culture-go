// カードから Claude.ai 対話への遷移プロンプトを組み立てる共通ユーティリティ。
// this-week / archive の両方から使う。バリアント:
//   - global : 世界の構造シフト
//   - shift  : サイゴン・シフト（動き・変化・告知）
//   - living : サイゴン・リビング（暮らしのテクスチャ）

export type PromptVariant = "global" | "shift" | "living";

export interface PromptCardSeed {
  title: string;
  summary?: string;
  source_urls: string[];
}

// すべてのバリアントで共通の補助指示。Claude 側で対話の質を上げる地ならし。
// すべて「無理に使う必要はない / 必要なら」と明示し、強制しない。
const ASSIST_BLOCK = [
  "【対話の進め方】",
  "- グラフ・画像・図解を使うと理解が深まる場面では、視覚的に説明してください（必須ではない、効果的な時だけ）。",
  "- 理解を助ける・深める関連記事があれば、推奨として一緒に提示してください（必須ではない、適切な時だけ）。",
  "- やり取りの中で、より正確で文脈に合った回答にするために必要なら、都度 web をリサーチしながら進めてください。",
  "",
];

function buildBody(variant: PromptVariant, card: PromptCardSeed): string[] {
  const summary = card.summary ?? "";
  const url = card.source_urls[0] ?? "";

  if (variant === "living") {
    return [
      "以下はホーチミン(サイゴン)の暮らしのテクスチャを切り取った記事。対話を通して深掘りしたい。",
      "",
      "【culturego サイゴン・リビングについて】",
      "culturego のサイゴン・リビングは、ホーチミンで今どう暮らしているかを",
      "場所・人・習慣の物語として週1で切り取るコーナー。",
      "",
      "【記事】",
      `タイトル: ${card.title}`,
      `要約: ${summary}`,
      `主要ソース: ${url}`,
      "",
      ...ASSIST_BLOCK,
      "【対話したいこと】",
      "",
    ];
  }

  if (variant === "shift") {
    return [
      "以下はホーチミン(サイゴン)のローカルな話題。対話を通して深掘りしたい。",
      "",
      "【culturego サイゴン・シフトについて】",
      "culturego のサイゴン・シフトは、ホーチミンで暮らす上で",
      "知っておくと役立つこと・会話のネタになる面白いことを週1で集めるコーナー。",
      "",
      "【話題】",
      `タイトル: ${card.title}`,
      `要約: ${summary}`,
      `主要ソース: ${url}`,
      "",
      ...ASSIST_BLOCK,
      "【対話したいこと】",
      "",
    ];
  }

  // global
  return [
    "以下の出来事について、対話を通して理解を深めたい。",
    "",
    "【culturego について】",
    "culturego は「世界の進む方向を読む」ためのスローメディア。",
    "力学が変わる構造的な出来事だけをスコアリングで抽出している。",
    "この記事は「力学が変わる出来事」として検出されたもの。",
    "",
    "【記事】",
    `タイトル: ${card.title}`,
    `要約: ${summary}`,
    `主要ソース: ${url}`,
    "",
    "【対話したい論点(例)】",
    "- そもそもこの事象の理解(背景・経緯)",
    "- 世界・日本・ベトナムの構造がどう変わりうるか",
    "- この先どのようなことが起きうるか",
    "",
    ...ASSIST_BLOCK,
    "【対話したいこと】",
    "",
  ];
}

export function buildClaudePromptUrl(
  variant: PromptVariant,
  card: PromptCardSeed,
): string {
  const prompt = buildBody(variant, card).join("\n");
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`;
}

// scope 値（バッジ値）からバリアントを判定するヘルパ。
// world/japan/vietnam → global / practical/trivia → shift / place/person/ritual → living
export function variantFromScope(
  scope:
    | "world"
    | "japan"
    | "vietnam"
    | "practical"
    | "trivia"
    | "place"
    | "person"
    | "ritual",
): PromptVariant {
  if (scope === "place" || scope === "person" || scope === "ritual") {
    return "living";
  }
  if (scope === "practical" || scope === "trivia") {
    return "shift";
  }
  return "global";
}
