"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { fetchOgImage, fetchUnsplashImage } from "@/lib/detect/extract-image";
import { isPaywallUrl, PAYWALL_HINT_FOR_PROMPT } from "@/lib/detect/paywall-domains";
import { revalidatePath } from "next/cache";

export type MarkResult = { ok: true } | { ok: false; error: string };

export async function markCardRead(cardId: string): Promise<MarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "no auth user (session expired?)" };
  }

  const { error } = await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "card_id" },
  );
  if (error) {
    return { ok: false, error: `${error.code ?? "?"} ${error.message}` };
  }
  return { ok: true };
}

export async function markCardDiscussed(cardId: string): Promise<MarkResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "no auth user (session expired?)" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("card_metadata").upsert(
    {
      card_id: cardId,
      is_read: true,
      discussed_at: now,
      updated_at: now,
    },
    { onConflict: "card_id" },
  );
  if (error) {
    return { ok: false, error: `${error.code ?? "?"} ${error.message}` };
  }
  return { ok: true };
}

export type BackfillResult =
  | { ok: true; updated: number; skipped: number }
  | { ok: false; error: string };

/**
 * hero_image_url が空のカードを 3 段で埋める:
 *   1) source_urls[0] の og:image
 *   2) 同じ HTML スキャンで本文 <img> (fetchOgImage 内で実行)
 *   3) keywords / title を Unsplash で検索 (UNSPLASH_ACCESS_KEY 必須)
 *
 * 過去カードには image_query が無いので keywords を join して代用。
 * Japanese keywords でも Unsplash は多少ヒットするが、英語混じりが望ましい。
 */
export async function backfillHeroImages(): Promise<BackfillResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data: missing, error } = await supabase
    .from("cards")
    .select("id, source_urls, keywords, title")
    .is("hero_image_url", null);

  if (error) return { ok: false, error: error.message };
  if (!missing || missing.length === 0)
    return { ok: true, updated: 0, skipped: 0 };

  const CONCURRENCY = 3;
  const results: ("updated" | "skipped")[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, missing.length) }, async () => {
      while (cursor < missing.length) {
        const i = cursor++;
        const c = missing[i];
        const url = (c.source_urls as string[] | null)?.[0];

        // ① og:image / 本文 img
        let hero = url ? await fetchOgImage(url) : null;

        // ② Unsplash フォールバック (keywords 上位 3 個 → title)
        if (!hero) {
          const keywords = (c.keywords as string[] | null) ?? [];
          const query =
            keywords.length > 0
              ? keywords.slice(0, 3).join(" ")
              : ((c.title as string) ?? "");
          hero = await fetchUnsplashImage(query);
        }

        if (!hero) {
          results[i] = "skipped";
          continue;
        }
        const upd = await supabase
          .from("cards")
          .update({ hero_image_url: hero })
          .eq("id", c.id);
        results[i] = upd.error ? "skipped" : "updated";
      }
    }),
  );

  const updated = results.filter((r) => r === "updated").length;
  const skipped = results.length - updated;
  revalidatePath("/");
  return { ok: true, updated, skipped };
}

// ── 3 Angles 生成 / 再生成 ──────────────────────────────────────────
// 1 枚のカードに対して、Claude Haiku + web_search で
// 実在する補足記事 (context / counterpoint / parallel) を 1 件ずつ取り、
// related_articles を上書きする。
type AngleKind = "context" | "counterpoint" | "parallel";
export interface RelatedArticleItem {
  kind: AngleKind;
  title: string;
  url: string;
  source: string;
}
export type GenerateRelatedResult =
  | { ok: true; related: RelatedArticleItem[] }
  | { ok: false; error: string };

export async function generateRelatedForCard(
  cardId: string,
): Promise<GenerateRelatedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { data: card, error: fetchErr } = await supabase
    .from("cards")
    .select("title, summary, why_important, source_urls, scope")
    .eq("id", cardId)
    .single();
  if (fetchErr || !card) {
    return { ok: false, error: fetchErr?.message ?? "カードが見つかりません" };
  }

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      system: `あなたは culturego (週刊スローメディア) の編集者。指定の主記事を補完する**実在の別記事**を web_search で 3 件探す。

3 件は以下の kind を 1 つずつ:
- context: 主記事の歴史背景・構造的文脈を扱う実記事
- counterpoint: 主記事と異なる視点・対立する読みの実記事
- parallel: 主記事と類似する過去事例を扱う実記事

ソース選定:
- 優先: Reuters, AP, BBC, NHK, 朝日, AlJazeera, AFP, 共同, 時事, DW, France24
- 不可: ペイウォール (${PAYWALL_HINT_FOR_PROMPT} 等) / 個人ブログ / wordpress 個人 / hatena 個人 / note 個人 / 匿名サイト / コンサル意見ブログ
- 必須: 実在する公開 URL であること、AI で要約した架空記事は禁止`,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 6,
        } as unknown as Anthropic.Messages.Tool,
        {
          name: "submit_related_articles",
          description: "3 件の補足記事を提出 (context/counterpoint/parallel 各 1)",
          input_schema: {
            type: "object" as const,
            properties: {
              articles: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      enum: ["context", "counterpoint", "parallel"],
                    },
                    title: { type: "string" },
                    url: { type: "string", format: "uri" },
                    source: { type: "string" },
                  },
                  required: ["kind", "title", "url", "source"],
                },
              },
            },
            required: ["articles"],
          },
        },
      ],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            "主記事:",
            `タイトル: ${card.title}`,
            `要約: ${card.summary}`,
            `なぜ重要か: ${card.why_important}`,
            `主要ソース: ${(card.source_urls as string[] | null)?.[0] ?? ""}`,
            `スコープ: ${card.scope}`,
            "",
            "この主記事を補完する 3 件の実記事 (context/counterpoint/parallel 各 1) を web_search で探し、submit_related_articles で返してください。",
          ].join("\n"),
        },
      ],
    });

    const submission = message.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === "submit_related_articles",
    );
    if (!submission) {
      return { ok: false, error: "AI 応答に補足記事が含まれていません" };
    }

    const raw = (submission.input as { articles?: unknown }).articles;
    if (!Array.isArray(raw)) {
      return { ok: false, error: "応答形式が不正です" };
    }

    const validKinds: AngleKind[] = ["context", "counterpoint", "parallel"];
    const cleaned: RelatedArticleItem[] = [];
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const r = item as Partial<RelatedArticleItem>;
      if (!r.kind || !validKinds.includes(r.kind)) continue;
      if (typeof r.title !== "string" || r.title.trim().length === 0) continue;
      if (typeof r.url !== "string" || !r.url.startsWith("http")) continue;
      if (typeof r.source !== "string" || r.source.trim().length === 0) continue;
      if (isPaywallUrl(r.url)) continue;
      cleaned.push({
        kind: r.kind,
        title: r.title.trim(),
        url: r.url,
        source: r.source.trim(),
      });
    }

    if (cleaned.length === 0) {
      return { ok: false, error: "有効な補足記事が見つかりませんでした (paywall フィルタ後)" };
    }

    const { error: updErr } = await supabase
      .from("cards")
      .update({ related_articles: cleaned })
      .eq("id", cardId);

    if (updErr) {
      return { ok: false, error: updErr.message };
    }

    revalidatePath("/");
    return { ok: true, related: cleaned };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Claude 呼び出しに失敗";
    return { ok: false, error: msg };
  }
}
