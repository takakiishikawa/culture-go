import { MapPin } from "lucide-react";
import { WeeklyFeed } from "@/app/_components/weekly-feed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saigon Local — culturego",
};

export default function LocalPage() {
  return (
    <WeeklyFeed
      channel="hcmc"
      eyebrow="Saigon Local"
      emptyTitle="今週のサイゴン・ローカルはまだ届いていません"
      emptyDescription="毎週日曜にホーチミンのローカルな話題を検出する。設定から手動でも回せる。"
      emptyIcon={<MapPin size={28} />}
    />
  );
}
