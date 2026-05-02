"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const NameSchema = z
  .string()
  .trim()
  .min(1, "タグ名を入力してください")
  .max(30, "30文字以内で入力してください");

async function requireAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");
  return supabase;
}

export async function createTag(rawName: string) {
  const name = NameSchema.parse(rawName);
  const supabase = await requireAuthedClient();

  const { data: maxRow } = await supabase
    .from("tags")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxRow?.display_order ?? 0) + 10;

  const { error } = await supabase
    .from("tags")
    .insert({ name, display_order: nextOrder });

  if (error) {
    if (error.code === "23505") throw new Error("同じ名前のタグが既にあります");
    throw new Error(error.message);
  }

  revalidatePath("/tags");
}

export async function renameTag(id: string, rawName: string) {
  const name = NameSchema.parse(rawName);
  const supabase = await requireAuthedClient();

  const { error } = await supabase
    .from("tags")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") throw new Error("同じ名前のタグが既にあります");
    throw new Error(error.message);
  }

  revalidatePath("/tags");
}

export async function deleteTag(id: string) {
  const supabase = await requireAuthedClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tags");
}

export async function reorderTags(orderedIds: string[]) {
  const supabase = await requireAuthedClient();

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("tags")
        .update({ display_order: (index + 1) * 10 })
        .eq("id", id),
    ),
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) throw new Error(failure.error.message);

  revalidatePath("/tags");
}
