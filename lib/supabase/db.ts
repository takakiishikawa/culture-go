import { createClient } from "@supabase/supabase-js";

// culturego スキーマのテーブル型
export type Scope = "world" | "japan" | "vietnam";

export interface RelatedArticle {
  title: string;
  url: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  title: string;
  summary: string;
  why_important: string;
  source_urls: string[];
  hero_image_url: string | null;
  scope: Scope;
  keywords: string[];
  related_articles: RelatedArticle[];
  published_at: string;
  created_at: string;
  updated_at: string;
}

export interface CardTag {
  card_id: string;
  tag_id: string;
}

export interface CardMetadata {
  card_id: string;
  is_read: boolean;
  user_memo: string;
  updated_at: string;
}

// culturego スキーマ固定のクライアント
export function createDb(accessToken?: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: "culturego" },
      global: accessToken
        ? { headers: { Authorization: `Bearer ${accessToken}` } }
        : undefined,
    },
  );
}

// service_role 接続。週1 cron バッチで RLS を bypass するため。
// SUPABASE_SERVICE_ROLE_KEY は秘匿（クライアント側に絶対漏らさない）。
export function createDbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      db: { schema: "culturego" },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
