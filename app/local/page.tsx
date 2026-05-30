import { MapPin } from "lucide-react";
import { WeeklyFeed } from "@/app/_components/weekly-feed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saigon Shift — culturego",
};

export default function LocalPage() {
  return (
    <WeeklyFeed
      channel="hcmc"
      eyebrow="Saigon Shift"
      emptyTitle="今週のサイゴン・シフトはまだ届いていません"
      emptyDescription="毎週日曜にホーチミンの動き・変化・告知を検出する。設定から手動でも回せる。"
      emptyIcon={<MapPin size={28} />}
    />
  );
}
