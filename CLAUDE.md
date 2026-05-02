@AGENTS.md

# culturego — CLAUDE.md

## プロダクト概要

**「世界の進む方向を読む、週次の点火装置」**

世界・日本・ベトナムで起きる「大きな出来事」を AI が週1で検出し、Claude 対話への深掘りトリガーを提供するスローメディア。瑣末な情報を浴びず、重要な構造変化だけを捉える。

### コア課題仮説

ユーザー（PM、ホーチミン在住、ASD的深掘り型、AI対話ネイティブ、抽象指向）にとって、

> 「興味関心ドメイン × 大きな出来事」を起点に、世界の方向性と会話の幅を広げる足場が欲しい。

既存手段（書籍 / NewsPicks / 新聞 / X / Voicy / Claude対話単体）はすべて欠陥がある。Claude 対話が唯一フィットするが、**3つの欠陥**を持つ:

1. **トリガー欠陥**: 何を話題にするか自分で思いつかない
2. **発見欠陥**: 興味ドメインで「大きな出来事」が起きたことに気づけない
3. **接合欠陥**: 仮想空間で完結し、現実アクションに繋がらない

culturego は 1, 2 を解決する週1配信と、3 を解決する Claude.ai への遷移ボタンで応える。

## 設計原則（妥協禁止）

1. **興味タグベース** — 構造化作業を強いない。タグ管理は最小
2. **AIが大きな出来事を判定** — 鋭さ・世界の方向性への影響で選定
3. **週1配信、ゼロ件OK** — スローメディア原則。無理に枠を埋めない
4. **深掘りは Claude.ai に委譲** — culturego は発見と接合に徹する
5. **海外メディアプロダクト（Stratechery / Air Mail / Monocle 等）のトーン** — ギャラリー型・余白を活かす・情報過多にしない

## Not Scope（意図的に作らない）

これらは作らない。「やらないことリスト」が culturego の本質。

- × 日次配信（週1で十分）
- × 通知・リマインダー（日曜 totonoi ルーティンに組み込む）
- × 構造化・タグ付け作業をユーザーに強いる UI
- × 対話ログの保存・検索（Claude.ai に残るので不要）
- × 接合アクション提案（必須ではない）
- × note / Obsidian 連携
- × 学習進捗グラフ・統計
- × ソーシャル機能
- × 過去カードのアーカイブ検索 UI（必要になったら追加）

## 技術スタック

- Framework: **Next.js 16 (App Router) + React 19 + TypeScript 6**
- Styling: **Tailwind CSS v4** + `@takaki/go-design-system`
- DB / Auth: Supabase（既存プロジェクトに `culturego` スキーマを追加）
- Deploy: Vercel（ドメイン: culturego.app）
- AI: `@anthropic-ai/sdk`（リサーチ系で大きな出来事を検出）
- Cron: GitHub Actions（土曜 23:00 Asia/Ho_Chi_Minh = UTC 16:00）

## 開発コマンド

```bash
npm install       # 依存関係インストール
npm run dev       # 開発サーバー (localhost:3000)
npm run build     # 本番ビルド
npm run lint      # ESLint
npm run detect    # 大きな出来事検出バッチを手動実行
```

## 環境変数

`.env.local` をプロジェクトルートに作成（コミット禁止）:

```
# Supabase（既存プロジェクトに culturego スキーマを追加）
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>

# 週1 cron バッチ専用（クライアントへ露出禁止）
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Anthropic API（大きな出来事の検出）
ANTHROPIC_API_KEY=<api key>
```

GitHub Actions Secrets には `ANTHROPIC_API_KEY` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定。

## 重要なルール

1. **`@takaki/go-design-system` を最優先** — UIコンポーネントだけでなくレイアウト・テンプレート・トークン・ユーティリティ・Hooks すべて DS から取る
2. **Server Components 優先** — `'use client'` は必要箇所のみ
3. **型安全** — `any` 型は使用しない
4. **AI SDK** — `@anthropic-ai/sdk` のみ使用（`openai` / `ai` / `@ai-sdk/*` は禁止）
5. **DB 変更は Supabase migration で** — 直 SQL は禁止
6. **「大きな出来事」の判定基準を緩めない** — 瑣末ニュースを混ぜて枠を埋めない
7. **構造化作業を強いる UI を作らない** — タグ管理は最小、ログは任意、メモは自由テキスト
8. **海外メディアトーンを死守** — 情報量で価値を出すサイトの逆。余白・写真・タイポグラフィで品位を出す

## go-design-system の使い方

### エントリで必須の import

```tsx
// app/globals.css 経由
@import "@takaki/go-design-system/theme.css";
// app/layout.tsx 経由
import { DesignTokens } from "@takaki/go-design-system";
```

### 提供される要素（直 import せず DS から取る）

- **UI**: Button, Card, Badge, Dialog, Sheet, Tabs, Sidebar 等（shadcn/ui 準拠）
- **レイアウト**: `AppLayout`, `PageHeader`
- **テンプレート**: `DashboardPage`, `LoginPage`, `AppSidebar` / `AppSwitcher` / `UserMenu`
- **Feedback**: `Banner`, `EmptyState`, `Spinner`, `Toaster` + `toast()`
- **Utilities**: `cn()`、`useIsMobile()`

### 設計指針

- ページ単位は **まず DS のテンプレートで作れないか確認** してから自前実装
- ボタン色や spacing は `tokens.css` の CSS 変数で上書き、コンポーネント内 hardcode は避ける
- Radix UI / sonner / clsx 等は **DS 経由のラッパー** で使う（直 import 禁止）

## パッケージ規則

| Layer | 内容 |
|-------|------|
| Foundation | next, react, typescript, tailwindcss, `@takaki/go-design-system` |
| Layer 1 (DS吸収) | Radix UI 等は直接importしない（DS経由で使う） |
| Layer 2 (全go共通) | `@supabase/*`, zod, date-fns, `@vercel/analytics` |
| Layer 3 (機能) | `@anthropic-ai/sdk`（検出バッチ専用） |
| 禁止 | `openai`, `ai`, `@ai-sdk/*` |

## データモデル（culturego スキーマ）

```sql
culturego.tags             -- 興味タグ
culturego.cards            -- 大きな出来事カード
culturego.card_tags        -- カードとタグの関連
culturego.card_metadata    -- 読了フラグ・自由メモ
```

## 画面構成

```
/             ホーム（カード一覧、ギャラリー）
/cards/[id]   カード詳細
/tags         タグ管理
```

## 5/10 判定基準

MVP として 5/10 に継続/廃止判定する。**カードの質**が最大のリスク。AI が瑣末ニュースを「大きな出来事」と判定したら即座に離脱するため、判定プロンプトを緩めない。

## セキュリティ

- **環境変数**: `.env.local` のみで管理。`NEXT_PUBLIC_*` プレフィックス以外をクライアントに露出しない
- **service_role キー**: GitHub Actions Secret に置く。フロント / Server Component から参照しない
- **依存の脆弱性**: `npm audit` を定期実行。high 以上は即解決
- **入力バリデーション**: 外部入力は zod でバリデート。Supabase クライアント経由のみ（生 SQL 禁止）
- **ログ**: API キー等の機密情報をログ出力しない
