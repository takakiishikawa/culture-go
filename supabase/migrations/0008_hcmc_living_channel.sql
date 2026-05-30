-- ============================================================
-- 0008: サイゴン・リビング（暮らし）チャンネル追加
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等（IF NOT EXISTS / DROP ... IF EXISTS）
-- ============================================================
-- 設計:
--   global        = 世界の構造シフト
--   hcmc          = サイゴン・シフト（旧 Saigon Local。動き / 変化 / 告知）
--   hcmc_living   = サイゴン・リビング（暮らしのテクスチャ。場所 / 人 / 習慣）
--
-- Living は 3軸スコア（story_depth / everyday_intimacy / reliability）を
-- 重み付き和した値を significance_score として書く。バッジは living_kind:
--   place   = 場所固有の物語
--   person  = 人物固有の物語
--   ritual  = 習慣 / 儀式 / 季節の振る舞い

-- channel の CHECK を 3 値に拡張。
ALTER TABLE culturego.cards
  DROP CONSTRAINT IF EXISTS cards_channel_check;

-- ADD COLUMN IF NOT EXISTS は新規 install 用に残してある。既存環境では
-- カラムは既にあるので skip され、↑ で外した制約を↓で付け直す。
ALTER TABLE culturego.cards
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'global';

ALTER TABLE culturego.cards
  ADD CONSTRAINT cards_channel_check
    CHECK (channel IN ('global', 'hcmc', 'hcmc_living'));

-- Living カードの分類。place=場所 / person=人 / ritual=習慣。
ALTER TABLE culturego.cards
  ADD COLUMN IF NOT EXISTS living_kind text
    CHECK (living_kind IN ('place', 'person', 'ritual'));

-- channel と kind の整合性:
--   global      : hcmc_kind=NULL, living_kind=NULL
--   hcmc        : hcmc_kind NOT NULL, living_kind=NULL
--   hcmc_living : hcmc_kind=NULL, living_kind NOT NULL
ALTER TABLE culturego.cards
  DROP CONSTRAINT IF EXISTS cards_hcmc_kind_consistency;

ALTER TABLE culturego.cards
  ADD CONSTRAINT cards_channel_kind_consistency CHECK (
    (channel = 'global'      AND hcmc_kind IS NULL     AND living_kind IS NULL) OR
    (channel = 'hcmc'        AND hcmc_kind IS NOT NULL AND living_kind IS NULL) OR
    (channel = 'hcmc_living' AND hcmc_kind IS NULL     AND living_kind IS NOT NULL)
  );

-- 既存 idx_cards_channel_published はそのまま 3 値に効く。追加は不要。
