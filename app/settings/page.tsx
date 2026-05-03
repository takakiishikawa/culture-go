import { RunDetectionButton } from "./run-detection";
import { BackfillImagesButton } from "./backfill-images";

export const metadata = {
  title: "設定 — culturego",
};

interface SectionProps {
  eyebrow: string;
  title: string;
  description: string;
  action: React.ReactNode;
}

function Section({ eyebrow, title, description, action }: SectionProps) {
  return (
    <section className="grid gap-10 py-10 md:grid-cols-[220px_1fr]">
      <header className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#999]">
          {eyebrow}
        </p>
        <h2 className="text-xl font-semibold leading-snug tracking-[-0.01em] text-[#1A1A1A]">
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
    <main className="min-h-full bg-white px-14 pt-8 pb-24 text-[#1A1A1A]">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-[#1A1A1A] pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-[#999]">
            settings
          </p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-[-0.018em]">
            設定
          </h1>
        </header>

        <div className="divide-y divide-[#F0F0F0]">
          <Section
            eyebrow="manual run"
            title="検出を手動で実行"
            description="通常は GitHub Actions が日曜 02:00 (Asia/Ho_Chi_Minh) に自動実行。検証用にここから即時実行できる。閾値以上のカードのみ DB に書き込まれる。"
            action={<RunDetectionButton />}
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
