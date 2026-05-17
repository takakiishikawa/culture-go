import { WeeklyFeed } from "@/app/_components/weekly-feed";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <WeeklyFeed
      channel="global"
      eyebrow="This Week"
      emptyTitle="今週はまだ届いていません"
      emptyDescription="土曜深夜に検出が走る。設定から手動でも回せる。"
    />
  );
}
