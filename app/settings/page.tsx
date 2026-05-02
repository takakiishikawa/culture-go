import { RunDetectionButton } from "./run-detection";

export const metadata = {
  title: "設定 — culturego",
};

export default function SettingsRoute() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 space-y-10">
      <header className="space-y-2">
        <p className="cg-eyebrow">settings</p>
        <h1 className="cg-display text-3xl text-[var(--cg-text)]">設定</h1>
      </header>

      <section className="rounded-md border border-[var(--cg-border-subtle)] bg-[var(--cg-surface)] p-6">
        <header className="mb-4 space-y-1">
          <p className="cg-eyebrow">manual run</p>
          <h2 className="cg-headline text-xl text-[var(--cg-text)]">
            検出を手動で実行
          </h2>
          <p className="text-sm text-[var(--cg-text-secondary)]">
            通常は GitHub Actions が土曜 23:00 (Asia/Ho_Chi_Minh) に自動実行。
            検証用にここから即時実行できる。閾値以上のカードのみ DB に書き込まれる。
          </p>
        </header>
        <RunDetectionButton />
      </section>
    </main>
  );
}
