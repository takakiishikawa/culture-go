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
  toast,
} from "@takaki/go-design-system";
import { Tag as TagIcon, Trash2 } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import {
  createTag,
  deleteTag,
  renameTag,
  reorderTags,
} from "./actions";
import type { Tag } from "@/lib/supabase/db";

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

  function runAction(fn: () => Promise<void>, errorPrefix: string) {
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        const message = err instanceof Error ? err.message : "失敗しました";
        toast.error(`${errorPrefix}: ${message}`);
      }
    });
  }

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = draft.trim();
    const validation = validateName(name);
    if (validation) {
      toast.error(validation);
      return;
    }
    runAction(async () => {
      await createTag(name);
      setDraft("");
      toast.success("タグを追加しました");
    }, "追加に失敗");
  }

  function handleRename(id: string, nextName: string) {
    const previous = tags.find((t) => t.id === id);
    if (!previous || previous.name === nextName.trim()) return;
    setTags((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name: nextName.trim() } : t)),
    );
    runAction(async () => {
      await renameTag(id, nextName);
    }, "名前変更に失敗");
  }

  function handleDelete(id: string) {
    const snapshot = tags;
    setTags((prev) => prev.filter((t) => t.id !== id));
    runAction(async () => {
      await deleteTag(id);
      toast.success("タグを削除しました");
    }, "削除に失敗");
    // optimistic restore on failure handled via revalidate from server
    void snapshot;
  }

  function handleReorder(orderedIds: string[]) {
    const tagMap = new Map(tags.map((t) => [t.id, t]));
    const reordered = orderedIds
      .map((id) => tagMap.get(id))
      .filter((t): t is Tag => Boolean(t));
    setTags(reordered);
    runAction(async () => {
      await reorderTags(orderedIds);
    }, "並び替えに失敗");
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

      {tags.length === 0 ? (
        <EmptyState
          icon={<TagIcon size={28} />}
          title="まだタグがありません"
          description="興味のあるドメインを 1 語ずつ加えて、検出範囲を伝えましょう。"
        />
      ) : (
        <DndProvider
          items={tags.map((t) => t.id)}
          onReorder={handleReorder}
        >
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
