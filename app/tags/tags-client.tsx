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
import { Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  createTag,
  deleteTag,
  generateTagSuggestions,
  renameTag,
} from "./actions";
import type { Tag } from "@/lib/supabase/db";
import { pickRecommendedTags } from "@/lib/tags/suggestions";

const DISMISSED_STORAGE_KEY = "cg.dismissed-suggestions";

function loadDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveDismissed(list: readonly string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // QuotaExceeded 等は無視 (致命的でない)
  }
}

function validateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Enter a tag name";
  if (trimmed.length > 30) return "Maximum 30 characters";
  return undefined;
}

const SUGGESTION_LOW_THRESHOLD = 10;
const SUGGESTION_DISPLAY_LIMIT = 25;
const AI_FETCH_THROTTLE_MS = 3000;
const AI_BATCH_SIZE = 20;

export function TagsClient({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const lastAiFetchRef = useRef(0);
  const [isPending, startTransition] = useTransition();

  // localStorage 読み込みは初回 mount で (SSR では空のまま)
  useEffect(() => {
    setDismissed(loadDismissed());
    setHydrated(true);
  }, []);

  const recommendations = useMemo(() => {
    const tagNames = tags.map((t) => t.name);
    const fromStatic = pickRecommendedTags(tagNames, {
      limit: SUGGESTION_DISPLAY_LIMIT,
      dismissed,
    });
    const seen = new Set(
      [
        ...tagNames,
        ...dismissed,
        ...fromStatic,
      ].map((s) => s.toLowerCase().trim()),
    );
    const fromAi = aiSuggestions.filter(
      (s) => !seen.has(s.toLowerCase().trim()),
    );
    return [...fromStatic, ...fromAi].slice(0, SUGGESTION_DISPLAY_LIMIT);
  }, [tags, dismissed, aiSuggestions]);

  // 推薦が枯れたら AI 補充。3 秒スロットルで無限ループ回避。
  useEffect(() => {
    if (!hydrated) return;
    if (recommendations.length >= SUGGESTION_LOW_THRESHOLD) return;
    if (aiLoading) return;
    const now = Date.now();
    if (now - lastAiFetchRef.current < AI_FETCH_THROTTLE_MS) return;
    lastAiFetchRef.current = now;

    let cancelled = false;
    setAiLoading(true);
    void generateTagSuggestions(
      tags.map((t) => t.name),
      [...dismissed, ...aiSuggestions],
      AI_BATCH_SIZE,
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.suggestions.length > 0) {
          setAiSuggestions((prev) =>
            Array.from(new Set([...prev, ...result.suggestions])),
          );
        } else if (!result.ok) {
          toast.error(`AI 補充に失敗: ${result.error}`);
        }
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, recommendations.length, aiLoading, tags, dismissed, aiSuggestions]);

  function dismissSuggestion(name: string) {
    setDismissed((prev) => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      saveDismissed(next);
      return next;
    });
  }

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
              <div key={name} className="group/sug relative">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => add(name)}
                  className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Add ${name}`}
                >
                  <TagChip className="gap-1 transition-colors group-hover/sug:border-[#1A1A1A] group-hover/sug:bg-[#FAFAF8]">
                    <Plus className="h-3 w-3 opacity-60" />
                    {name}
                  </TagChip>
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => dismissSuggestion(name)}
                  aria-label={`Dismiss ${name}`}
                  className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-[#1A1A1A] bg-white text-[#1A1A1A] shadow-sm transition-opacity group-hover/sug:flex hover:bg-[#1A1A1A] hover:text-white"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                </button>
              </div>
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
