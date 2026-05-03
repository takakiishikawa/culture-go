-- ============================================================
-- 0003: service_role に culturego スキーマへの権限を付与
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等（再実行 OK）
--
-- 背景: GitHub Actions の検出 cron は service_role で接続する。
-- service_role は RLS を bypass するが、カスタムスキーマの
-- USAGE / DML 権限は明示的に GRANT が要る。
-- ============================================================

-- スキーマ参照権
GRANT USAGE ON SCHEMA culturego TO service_role;

-- 既存テーブル（tags / cards / card_tags / card_metadata / scoring_dimensions）
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA culturego TO service_role;

-- 今後 culturego に新テーブルを足したときも自動で GRANT が付くように
ALTER DEFAULT PRIVILEGES IN SCHEMA culturego
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- シーケンス（uuid_generate_v4 の代わりに将来 serial を使った場合の保険）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA culturego TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA culturego
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;
