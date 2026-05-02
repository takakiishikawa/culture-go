import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="cg-eyebrow mb-6">culturego</p>
      <h1 className="cg-display text-5xl text-[var(--cg-text)]">
        世界の進む方向を読む、
        <br />
        週次の点火装置。
      </h1>
      <p className="cg-body mt-8 text-lg text-[var(--cg-text-secondary)]">
        Phase 0 scaffold. ギャラリー / カード詳細は Phase 2 で実装します。
      </p>
      <p className="mt-10">
        <Link
          href="/tags"
          className="cg-eyebrow underline-offset-4 hover:underline"
        >
          → タグ管理
        </Link>
      </p>
    </main>
  );
}
