"use client";

import {
  Button,
  ConfirmDialog,
  EmptyState,
  InlineEdit,
  Input,
  Tag as TagChip,
  TagGroup,
  toast,
} from "@takaki/go-design-system";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { createTag, deleteTag, renameTag } from "./actions";
import type { Tag } from "@/lib/supabase/db";
import { pickRecommendedTags } from "@/lib/tags/suggestions";

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Enter a tag name";
  if (trimmed.length > 30) return "Maximum 30 characters";
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
        toast.error(`Failed to add: ${result.error}`);
        return;
      }
      setTags((prev) => [...prev, result.tag]);
      toast.success(`Added “${result.tag.name}”`);
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
        toast.error(`Failed to rename: ${result.error}`);
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
        toast.error(`Failed to delete: ${result.error}`);
        setTags(snapshot);
        return;
      }
      toast.success("Tag deleted");
    });
  }

  return (
    <section className="mt-10 space-y-12">
      <form onSubmit={handleAdd} className="flex gap-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a tag"
          maxLength={30}
          disabled={isPending}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending || draft.trim().length === 0}>
          Add
        </Button>
      </form>

      {recommendations.length > 0 && (
        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#999]">
            Suggestions
          </p>
          <TagGroup wrap>
            {recommendations.map((name) => (
              <button
                key={name}
                type="button"
                disabled={isPending}
                onClick={() => add(name)}
                className="group cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Add ${name}`}
              >
                <TagChip className="gap-1 transition-colors group-hover:border-[#1A1A1A] group-hover:bg-[#FAFAF8]">
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
          title="No tags yet"
          description="Add interest domains one word at a time."
        />
      ) : (
        <ul>
          {tags.map((tag, i) => (
            <li
              key={tag.id}
              className={
                "flex items-center gap-4 py-3" +
                (i === 0 ? "" : " border-t border-[#F0F0F0]")
              }
            >
              <div className="min-w-0 flex-1">
                <InlineEdit
                  value={tag.name}
                  onChange={(next) => handleRename(tag.id, next)}
                  validate={validateName}
                  placeholder="Tag name"
                />
              </div>
              <ConfirmDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${tag.name}`}
                  >
                    <Trash2 size={16} />
                  </Button>
                }
                title={`Delete “${tag.name}”?`}
                description="Cards linked to this tag will lose the association, but the cards themselves remain."
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={() => handleDelete(tag.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
