import { RunDetectionButton } from "./run-detection";
import { BackfillImagesButton } from "./backfill-images";

export const metadata = {
  title: "Settings — culturego",
};

interface SectionProps {
  eyebrow: string;
  title: string;
  description: string;
  action: React.ReactNode;
}

function Section({ eyebrow, title, description, action }: SectionProps) {
  return (
    <section className="grid gap-6 py-10 md:grid-cols-[200px_1fr] md:gap-10">
      <header className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#999]">
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold tracking-[-0.005em] text-[#1A1A1A]">
          {title}
        </h2>
      </header>
      <div className="space-y-5">
        <p className="text-sm leading-7 text-[#666]">{description}</p>
        <div>{action}</div>
      </div>
    </section>
  );
}

export default function SettingsRoute() {
  return (
    <main className="min-h-full bg-white text-[#1A1A1A]">
      <div className="mx-auto max-w-4xl px-3 pt-8 pb-24 md:px-14">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#999]">
            Settings
          </p>
        </header>

        <div className="mt-6 divide-y divide-[#F0F0F0]">
          <Section
            eyebrow="manual run"
            title="検出を手動で実行"
            description="通常は GitHub Actions が日曜 02:00 (Asia/Ho_Chi_Minh) に自動実行。検証用にここから即時実行できる。閾値以上のカードのみ DB に書き込まれる。"
            action={<RunDetectionButton />}
          />
          <Section
            eyebrow="manual run · shift"
            title="サイゴン・シフト検出を手動で実行"
            description="ホーチミンの動き・変化・告知（実用 / 小ネタ）を検出する。global と同じ週次 cron で自動実行されるが、検証用にここから即時実行できる。"
            action={<RunDetectionButton channel="hcmc" />}
          />
          <Section
            eyebrow="manual run · living"
            title="サイゴン・リビング検出を手動で実行"
            description="ホーチミンの暮らしのテクスチャ（場所・人・習慣）を検出する。Shift とは別ロジックで、出来事ではなく状態を切り取る。週次 cron で自動実行される。"
            action={<RunDetectionButton channel="hcmc_living" />}
          />
          <Section
            eyebrow="images"
            title="既存カードの画像を補完"
            description="画像が空のカードについて、source の og:image を取得して埋める。新規検出から自動で取得されるが、過去に検出済みのカード向け。"
            action={<BackfillImagesButton />}
          />
        </div>
      </div>
    </main>
  );
}
