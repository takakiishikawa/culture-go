-- ============================================================
-- 0002: scoring_dimensions（編集可能なスコアリング軸）+ 包括的 GRANT
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 既存環境にも安全に流せる（CREATE TABLE IF NOT EXISTS / GRANT 冪等）
-- ============================================================

-- スキーマアクセス権（既に GRANT 済みでも冪等に上書き）
GRANT USAGE ON SCHEMA culturego TO authenticated;

-- 既存テーブル（tags, cards, card_tags, card_metadata）に GRANT を与える
-- ※ ユーザーが過去の GRANT 設定を未実行の場合の救済を兼ねる
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA culturego TO authenticated;

-- 今後 culturego に新テーブルを足したときも自動で GRANT が付くように
ALTER DEFAULT PRIVILEGES IN SCHEMA culturego
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- スコアリング軸（編集可能）
CREATE TABLE IF NOT EXISTS culturego.scoring_dimensions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text NOT NULL,
  description   text NOT NULL,
  rubric        text NOT NULL,
  weight        numeric(4,2) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT scoring_dimensions_label_unique UNIQUE (label)
);

CREATE INDEX IF NOT EXISTS idx_scoring_dimensions_order
  ON culturego.scoring_dimensions (display_order);

-- シード（3 軸 / 重み 3:4:3）— 構造的変化が culturego の核
INSERT INTO culturego.scoring_dimensions (label, description, rubric, weight, display_order) VALUES
  (
    '影響範囲',
    '国家・業界・地域全体に影響する出来事',
    '0=ごく局所的/3=単一国の一部/5=単一国全体/7=複数国・大陸/9=世界全体',
    0.30,
    1
  ),
  (
    '構造的変化',
    '力学が変わる出来事 — culturego の核となる軸',
    '0=既知トレンドの延長/3=注目に値する新事象/5=想定外の転回/7=力学が変わる転換/9=パラダイム転換',
    0.40,
    2
  ),
  (
    '信頼性',
    '情報源の確度・検証可能性',
    '0=単一の二次ソース/3=複数の二次ソース/5=主要報道機関/7=複数の一次ソース/9=公式発表+独立検証',
    0.30,
    3
  )
ON CONFLICT (label) DO NOTHING;
