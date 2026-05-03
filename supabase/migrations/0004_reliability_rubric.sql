-- ============================================================
-- 0004: 信頼性 軸の rubric を強化
--   個人ブログ / コンサル意見 / wordpress 個人 = 0 と明示し、
--   主要報道機関を 5 と置く。コード側 (RELIABILITY_MIN=5) と整合。
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等
-- ============================================================

UPDATE culturego.scoring_dimensions
SET
  rubric = '0=個人ブログ・コンサル意見・匿名サイト・wordpress 個人 / 3=複数の二次ソース or 業界誌 / 5=主要報道機関 (Reuters, AP, BBC, NHK, 朝日 等) / 7=複数の一次ソース (政府発表 + 当該機関の公式) / 9=公式発表 + 独立検証',
  updated_at = now()
WHERE label = '信頼性';
