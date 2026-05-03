-- ============================================================
-- 0006: card_metadata がリロードで初期化される件の修正
--   原因: 0001 で card_metadata を作ったが authenticated ロールへ
--         GRANT を付けず、RLS も無効のまま。Supabase の anon key で
--         接続するクライアント (= ログイン後 authenticated ロール) は
--         書き込みがサイレント失敗していた。
--   方針: 当面は単一ユーザー想定 (rittukk1@gmail.com 専用) なので
--         authenticated に対しては全行 R/W を許可する単純ポリシー。
--         将来マルチユーザー化するときに card_metadata を
--         (card_id, user_id) PK に変えてポリシーを user_id 一致に
--         置き換える。
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等
-- ============================================================

-- スキーマ USAGE (既存付与なら NO-OP)
GRANT USAGE ON SCHEMA culturego TO authenticated;

-- 読み取り対象 (cards / tags / card_tags) の SELECT を念のため明示
GRANT SELECT
  ON culturego.cards, culturego.tags, culturego.card_tags
  TO authenticated;

-- card_metadata は読み書き両方
GRANT SELECT, INSERT, UPDATE, DELETE
  ON culturego.card_metadata TO authenticated;

-- RLS 有効化
ALTER TABLE culturego.card_metadata ENABLE ROW LEVEL SECURITY;

-- 単一ユーザー前提の素朴ポリシー
DROP POLICY IF EXISTS card_metadata_authenticated_all
  ON culturego.card_metadata;

CREATE POLICY card_metadata_authenticated_all
  ON culturego.card_metadata
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
