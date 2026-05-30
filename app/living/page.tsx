import { Sofa } from "lucide-react";
import { WeeklyFeed } from "@/app/_components/weekly-feed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Saigon Living — culturego",
};

export default function LivingPage() {
  return (
    <WeeklyFeed
      channel="hcmc_living"
      eyebrow="Saigon Living"
      emptyTitle="今週のサイゴン・リビングはまだ届いていません"
      emptyDescription="毎週日曜にホーチミンの暮らしのテクスチャ（場所・人・習慣）を切り取る。設定から手動でも回せる。"
      emptyIcon={<Sofa size={28} />}
    />
  );
}
