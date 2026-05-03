-- ============================================================
-- 0005: Claude 対話開始のトラッキング列を追加
--   ホーム / アーカイブで「Claude アイコンを押した = 対話に踏み出した」
--   状態を「読んだ」と独立に表示するため。
--   既存行はゼロ更新 (NULL = 未対話)。
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等
-- ============================================================

ALTER TABLE culturego.card_metadata
  ADD COLUMN IF NOT EXISTS discussed_at timestamptz;
