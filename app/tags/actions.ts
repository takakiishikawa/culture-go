"use server";

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

