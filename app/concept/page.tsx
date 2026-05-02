import { ConceptPage } from "@takaki/go-design-system";
import { Compass } from "lucide-react";
import { SIGNIFICANCE_THRESHOLD } from "@/lib/detect/dimensions";

export const metadata = {
  title: "コンセプト — culturego",
};

export default function ConceptRoute() {
  return (
    <ConceptPage
      className="pt-0 px-0"
      productName="CultureGo"
      productLogo={
        <div className="flex items-center justify-center rounded-md bg-primary p-1.5">
          <Compass className="h-3.5 w-3.5 text-white" />
        </div>
      }
      tagline="世界の進む方向を、週1で読むスローメディア"
      coreMessage="瑣末な情報を浴びるのをやめ、世界の構造を変える「大きな出来事」だけを週1で受け取る。Claude 対話への深掘りトリガーを置き、興味タグから世界の方向と会話の幅を広げる足場をつくる。"
      coreValue="興味タグ × 大きな出来事 = 深掘りの起点。情報量で勝負しない、編集された静けさ。"
      scope={{
        solve: [
          "週1で大きな出来事を AI が検出して配信",
          "興味ドメインに沿ったトリガーの提供",
          "Claude.ai への深掘り遷移ボタン",
          "タグ管理（最小）と既読管理",
        ],
        notSolve: [
          "日次配信・速報・通知",
          "タグや構造化作業をユーザーに強いる UI",
          "対話ログの保存・検索（Claude.ai に残る）",
          "学習進捗グラフ・統計",
          "ソーシャル機能",
        ],
      }}
      productLogic={{
        steps: [
          {
            title: "興味タグ",
            description:
              "ユーザーは興味のあるドメインを 1 語ずつ登録。最小限の構造化のみ。",
          },
          {
            title: "週1検出",
            description:
              "土曜深夜に AI が直近 7 日のニュースを web 検索し、編集可能なルブリックでスコアリング。",
          },
          {
            title: "閾値フィルタ",
            description: `重み付き総合スコアが ${SIGNIFICANCE_THRESHOLD} 以上のものだけをカードとして配信。ゼロ件 OK。`,
          },
          {
            title: "深掘り",
            description:
              "カードから Claude.ai へ遷移し、対話で世界の方向と会話の幅を広げる。",
          },
          {
            title: "既読",
            description:
              "外部リンクを開いたカードは静かに dim され、未読との区別を保つ。",
          },
        ],
        outcome:
          "週1の編集された配信が「Claude 対話 → 現実アクション」を起こす最小の点火装置として機能する。",
      }}
      resultMetric={{
        title: "週次の Claude 対話起点率",
        description:
          "配信されたカード数に対して、Claude.ai への遷移を伴った対話に発展した割合。スローメディア成立の指標。",
      }}
      behaviorMetrics={[
        {
          title: "週次の閾値超え検出数",
          description: `スコア ${SIGNIFICANCE_THRESHOLD} 以上として配信されたカード数。0 件も許容する。`,
        },
        {
          title: "カード閲覧率",
          description: "配信カードに対する is_read = true の割合。",
        },
        {
          title: "Claude.ai 遷移率",
          description:
            "カード上の深掘りボタン経由で Claude.ai へ遷移した割合。",
        },
        {
          title: "タグ更新頻度",
          description:
            "タグの追加/削除/並べ替えの頻度。低いほど興味の固定化が進む。",
        },
      ]}
    />
  );
}
