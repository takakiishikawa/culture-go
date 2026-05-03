"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Tag } from "@/lib/supabase/db";

const NameSchema = z
  .string()
  .trim()
  .min(1, "タグ名を入力してください")
  .max(30, "30文字以内で入力してください");

export type ActionResult = { ok: true } | { ok: false; error: string };
export type CreateTagResult =
  | { ok: true; tag: Tag }
  | { ok: false; error: string };

async function requireAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "ログインが必要です" };
  return { ok: true as const, supabase };
}

function parseDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "同じ名前のタグが既にあります";
  if (error.code === "42501") return "DB の権限が不足しています（GRANT を確認）";
  return error.message;
}

export async function createTag(rawName: string): Promise<CreateTagResult> {
  const parsed = NameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = parsed.data;

  const auth = await requireAuthedClient();
  if (!auth.ok) return auth;

  const { data: maxRow } = await auth.supabase
    .from("tags")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.display_order ?? 0) + 10;

  const { data: created, error } = await auth.supabase
    .from("tags")
    .insert({ name, display_order: nextOrder })
    .select("id, name, display_order, created_at, updated_at")
    .single();

  if (error || !created) {
    return {
      ok: false,
      error: parseDbError(error ?? { message: "insert returned no row" }),
    };
  }

  revalidatePath("/tags");
  return { ok: true, tag: created as Tag };
}

export async function renameTag(
  id: string,
  rawName: string,
): Promise<ActionResult> {
  const parsed = NameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const name = parsed.data;

  const auth = await requireAuthedClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase
    .from("tags")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, error: parseDbError(error) };

  revalidatePath("/tags");
  return { ok: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const auth = await requireAuthedClient();
  if (!auth.ok) return auth;

  const { error } = await auth.supabase.from("tags").delete().eq("id", id);
  if (error) return { ok: false, error: parseDbError(error) };

  revalidatePath("/tags");
  return { ok: true };
}

// ── AI tag suggestions ───────────────────────────────────────────────
// 静的プールが枯れた時の補充。Claude (Haiku) に既存 + dismissed を渡して
// 重複しない新しいタグを N 件生成させる。
export type SuggestionResult =
  | { ok: true; suggestions: string[] }
  | { ok: false; error: string };

export async function generateTagSuggestions(
  existing: string[],
  dismissed: string[],
  count = 15,
): Promise<SuggestionResult> {
  const auth = await requireAuthedClient();
  if (!auth.ok) return auth;

  const safeCount = Math.max(5, Math.min(30, count));

  try {
    const anthropic = new Anthropic();
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `あなたは culturego (週刊スローメディア) の興味タグ推薦エンジン。

ユーザーは ホーチミン在住の PM、抽象指向、AI 対話ネイティブ。
「世界の進む方向を変える構造シフト」を捉える編集者の感覚で、
新しい興味タグ (1 語または 2-3 語の短いフレーズ) を提案する。

ルール:
- 1-15 字の短いタグ
- 既存タグと dismissed には絶対に被らない (大文字小文字・スペース無視で完全一致を避ける)
- 速報・芸能・スポーツ・有名人・犯罪は出さない
- 個別企業名より構造を表す概念 (例: "通貨同盟" > "JPMorgan")
- 日本語ベース、必要なら英語混じり可`,
      tools: [
        {
          name: "submit_suggestions",
          description: "新しい興味タグの候補リストを返す",
          input_schema: {
            type: "object" as const,
            properties: {
              suggestions: {
                type: "array",
                items: { type: "string" },
                minItems: safeCount,
                maxItems: safeCount,
              },
            },
            required: ["suggestions"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "submit_suggestions" },
      messages: [
        {
          role: "user",
          content: [
            `existing tags: ${existing.join(", ") || "(none)"}`,
            `dismissed: ${dismissed.join(", ") || "(none)"}`,
            "",
            `${safeCount} 個の新しいタグを submit_suggestions で返してください。`,
          ].join("\n"),
        },
      ],
    });

    const submission = message.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock =>
        b.type === "tool_use" && b.name === "submit_suggestions",
    );
    if (!submission) return { ok: false, error: "AI からの応答が空でした" };

    const raw = (submission.input as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(raw)) return { ok: false, error: "応答形式が不正" };

    const seen = new Set(
      [...existing, ...dismissed].map((s) => s.toLowerCase().trim()),
    );
    const cleaned: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const t = item.trim();
      if (t.length === 0 || t.length > 30) continue;
      if (seen.has(t.toLowerCase())) continue;
      seen.add(t.toLowerCase());
      cleaned.push(t);
    }
    return { ok: true, suggestions: cleaned };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI 呼び出しに失敗";
    return { ok: false, error: msg };
  }
}

