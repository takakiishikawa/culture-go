"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionResult = { ok: true } | { ok: false; error: string };

const DimensionInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1, "ラベルは必須です").max(30, "30字以内で"),
  description: z
    .string()
    .trim()
    .min(1, "説明は必須です")
    .max(200, "200字以内で"),
  rubric: z
    .string()
    .trim()
    .min(1, "採点基準は必須です")
    .max(500, "500字以内で"),
  weight: z
    .number()
    .min(0, "重みは 0 以上")
    .max(1, "重みは 1 以下"),
});

const PayloadSchema = z.object({
  dimensions: z.array(DimensionInput).min(1, "軸を 1 つ以上残してください"),
});

export type DimensionInputType = z.infer<typeof DimensionInput>;

function parseDbError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "同じラベルの軸が既にあります";
  if (error.code === "42501") return "DB の権限が不足しています（GRANT を確認）";
  if (error.code === "42P01")
    return "scoring_dimensions テーブルがありません（migration 0002 を実行）";
  return error.message;
}

export async function saveDimensions(
  payload: z.input<typeof PayloadSchema>,
): Promise<ActionResult> {
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "ログインが必要です" };

  const { dimensions } = parsed.data;

  const { data: current, error: fetchError } = await supabase
    .from("scoring_dimensions")
    .select("id");
  if (fetchError) return { ok: false, error: parseDbError(fetchError) };

  const currentIds = new Set((current ?? []).map((r) => r.id as string));
  const payloadIds = new Set(
    dimensions.filter((d) => d.id).map((d) => d.id as string),
  );
  const toDelete = [...currentIds].filter((id) => !payloadIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("scoring_dimensions")
      .delete()
      .in("id", toDelete);
    if (error) return { ok: false, error: parseDbError(error) };
  }

  const rows = dimensions.map((d, i) => ({
    ...(d.id ? { id: d.id } : {}),
    label: d.label,
    description: d.description,
    rubric: d.rubric,
    weight: d.weight,
    display_order: (i + 1) * 10,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("scoring_dimensions")
    .upsert(rows);
  if (upsertError) return { ok: false, error: parseDbError(upsertError) };

  revalidatePath("/scoring");
  return { ok: true };
}
