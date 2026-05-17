-- ============================================================
-- 0007: ① 影響範囲軸を scope 相対評価に / ② ホーチミン・ローカルチャンネル
-- 適用方法: Supabase Dashboard → SQL Editor で全文を Run
-- 冪等（IF NOT EXISTS / DROP ... IF EXISTS / UPDATE）
-- ============================================================

-- ① 影響範囲を scope 相対に
--   従来 rubric は「9=世界全体」固定で、日本国内・ベトナム国内で広く影響する
--   出来事が世界スケールで過小評価され、World 以外がほぼ配信されなかった。
--   scope=world は世界、scope=japan は日本、scope=vietnam はベトナムを
--   「その地域全体」とみなして相対評価する。
UPDATE culturego.scoring_dimensions
SET
  description = 'カードの scope が示す地域（world=世界 / japan=日本 / vietnam=ベトナム）の中で、どこまで広く影響するか',
  rubric = '※ scope の地域内で相対評価する（world→世界 / japan→日本 / vietnam→ベトナム）。0=ごく局所的 / 3=地域の一部 / 5=地域の主要部に波及 / 7=地域の広範囲に波及 / 9=地域全体に波及',
  updated_at = now()
WHERE label = '影響範囲';

-- ② ホーチミン・ローカルチャンネル
--   global  = 世界の構造シフト（既存）
--   hcmc    = ホーチミン・ローカル（実用 / 小ネタ）
ALTER TABLE culturego.cards
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'global'
    CHECK (channel IN ('global', 'hcmc'));

-- hcmc カードの分類。practical=実用 / trivia=小ネタ。global では NULL。
ALTER TABLE culturego.cards
  ADD COLUMN IF NOT EXISTS hcmc_kind text
    CHECK (hcmc_kind IN ('practical', 'trivia'));

-- channel と hcmc_kind の整合性: hcmc は必須、global は NULL
ALTER TABLE culturego.cards
  DROP CONSTRAINT IF EXISTS cards_hcmc_kind_consistency;
ALTER TABLE culturego.cards
  ADD CONSTRAINT cards_hcmc_kind_consistency CHECK (
    (channel = 'hcmc'   AND hcmc_kind IS NOT NULL) OR
    (channel = 'global' AND hcmc_kind IS NULL)
  );

CREATE INDEX IF NOT EXISTS idx_cards_channel_published
  ON culturego.cards (channel, published_at DESC);
