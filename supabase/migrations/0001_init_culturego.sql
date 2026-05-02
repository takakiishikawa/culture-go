-- ============================================================
-- culturego テーブル作成 SQL
-- 前提: culturego スキーマは既に作成済み
-- 適用方法: Supabase Dashboard → SQL Editor で手動実行
-- ============================================================

-- 興味タグ
CREATE TABLE culturego.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- カード(大きな出来事)
CREATE TABLE culturego.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL,
  why_important text NOT NULL,
  source_urls text[] NOT NULL,
  hero_image_url text,
  scope text NOT NULL CHECK (scope IN ('world', 'japan', 'vietnam')),
  keywords text[] DEFAULT '{}',
  related_articles jsonb DEFAULT '[]',
  significance_score numeric(3,1) NOT NULL DEFAULT 5.5
    CHECK (significance_score >= 0.0 AND significance_score <= 10.0),
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- カードとタグの関連
CREATE TABLE culturego.card_tags (
  card_id uuid REFERENCES culturego.cards(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES culturego.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

-- ユーザーアクション
CREATE TABLE culturego.card_metadata (
  card_id uuid PRIMARY KEY REFERENCES culturego.cards(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false,
  user_memo text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

-- インデックス
CREATE INDEX idx_cards_significance_score
  ON culturego.cards (significance_score DESC, published_at DESC);

CREATE INDEX idx_cards_published_at
  ON culturego.cards (published_at DESC);

CREATE INDEX idx_cards_scope
  ON culturego.cards (scope);

-- 初期タグデータ
INSERT INTO culturego.tags (name, display_order) VALUES
  ('AI', 1),
  ('国際政治', 2),
  ('東南アジア政治', 3),
  ('ベトナム政治', 4),
  ('世界経済', 5),
  ('日本政治', 6);
