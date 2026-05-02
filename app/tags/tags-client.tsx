"use client";

import {
  Button,
  ConfirmDialog,
  DndProvider,
  DragHandle,
  EmptyState,
  InlineEdit,
  Input,
  SortableItem,
  Tag as TagChip,
  TagGroup,
  toast,
} from "@takaki/go-design-system";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import {
  createTag,
  deleteTag,
  renameTag,
  reorderTags,
} from "./actions";
import type { Tag } from "@/lib/supabase/db";
import { pickRecommendedTags } from "@/lib/tags/suggestions";

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "タグ名を入力してください";
  if (trimmed.length > 30) return "30文字以内で入力してください";
  return undefined;
}

export function TagsClient({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  const recommendations = useMemo(
    () => pickRecommendedTags(tags.map((t) => t.name), 25),
    [tags],
  );

  function add(name: string) {
    const trimmed = name.trim();
    const validation = validateName(trimmed);
    if (validation) {
      toast.error(validation);
      return;
    }
    startTransition(async () => {
      const result = await createTag(trimmed);
      if (!result.ok) {
        toast.error(`追加に失敗: ${result.error}`);
        return;
      }
      setTags((prev) => [...prev, result.tag]);
      toast.success(`「${result.tag.name}」を追加しました`);
    });
  }

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    add(draft);
    setDraft("");
  }

  function handleRename(id: string, nextName: string) {
    const trimmed = nextName.trim();
    const previous = tags.find((t) => t.id === id);
    if (!previous || previous.name === trimmed) return;

    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: trimmed } : t)),
    );
    startTransition(async () => {
      const result = await renameTag(id, trimmed);
      if (!result.ok) {
        toast.error(`名前変更に失敗: ${result.error}`);
        // ロールバック
        setTags((prev) =>
          prev.map((t) => (t.id === id ? { ...t, name: previous.name } : t)),
        );
      }
    });
  }

  function handleDelete(id: string) {
    const snapshot = tags;
    setTags((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      const result = await deleteTag(id);
      if (!result.ok) {
        toast.error(`削除に失敗: ${result.error}`);
        setTags(snapshot);
        return;
      }
      toast.success("タグを削除しました");
    });
  }

  function handleReorder(orderedIds: string[]) {
    const snapshot = tags;
    const tagMap = new Map(tags.map((t) => [t.id, t]));
    const reordered = orderedIds
      .map((id) => tagMap.get(id))
      .filter((t): t is Tag => Boolean(t));
    setTags(reordered);
    startTransition(async () => {
      const result = await reorderTags(orderedIds);
      if (!result.ok) {
        toast.error(`並び替えに失敗: ${result.error}`);
        setTags(snapshot);
      }
    });
  }

  return (
    <section className="mt-10 space-y-8">
      <form onSubmit={handleAdd} className="flex gap-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="例: 半導体、地政学、AI規制"
          maxLength={30}
          disabled={isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || draft.trim().length === 0}>
          追加
        </Button>
      </form>

      {recommendations.length > 0 && (
        <div className="space-y-3">
          <p className="cg-eyebrow">候補</p>
          <TagGroup wrap>
            {recommendations.map((name) => (
              <button
                key={name}
                type="button"
                disabled={isPending}
                onClick={() => add(name)}
                className="group cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`${name} を追加`}
              >
                <TagChip className="gap-1 transition-colors group-hover:border-[var(--cg-border)] group-hover:bg-[var(--cg-surface-2)]">
                  <Plus className="h-3 w-3 opacity-60" />
                  {name}
                </TagChip>
              </button>
            ))}
          </TagGroup>
        </div>
      )}

      {tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon size={28} />}
          title="まだタグがありません"
          description="興味のあるドメインを 1 語ずつ加えて、検出範囲を伝えましょう。"
        />
      ) : (
        <DndProvider items={tags.map((t) => t.id)} onReorder={handleReorder}>
          <ul className="space-y-2">
            {tags.map((tag) => (
              <SortableItem
                key={tag.id}
                id={tag.id}
                className="flex items-center gap-3 rounded-md border border-[var(--cg-border-subtle)] bg-[var(--cg-surface)] px-3 py-2"
              >
                <DragHandle aria-label="並び替え" />
                <div className="flex-1 min-w-0">
                  <InlineEdit
                    value={tag.name}
                    onChange={(next) => handleRename(tag.id, next)}
                    validate={validateName}
                    placeholder="タグ名"
                  />
                </div>
                <ConfirmDialog
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${tag.name} を削除`}
                    >
                      <Trash2 size={16} />
                    </Button>
                  }
                  title={`「${tag.name}」を削除しますか？`}
                  description="このタグに紐づくカードの関連付けは外れますが、カード自体は残ります。"
                  confirmLabel="削除"
                  variant="destructive"
                  onConfirm={() => handleDelete(tag.id)}
                />
              </SortableItem>
            ))}
          </ul>
        </DndProvider>
      )}
    </section>
  );
}
