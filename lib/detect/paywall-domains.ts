// 候補ソースから除外するペイウォール / 部分閲覧専用ドメイン。
// 無料公開部分も多い metered サイトは含めない (記事ごとに当たり外れがあるため)。
// publisher 側の判定ミスは許容、本当に "途中で読めない" 主要サイトのみ。

const PAYWALL_DOMAINS = new Set([
  // 英語圏 hard paywall
  "ft.com",
  "wsj.com",
  "bloomberg.com",
  "economist.com",
  "newyorker.com",
  "foreignaffairs.com",
  "foreignpolicy.com",
  "harpers.org",
  "theinformation.com",
  "thetimes.co.uk",
  "telegraph.co.uk",
  // 英語圏 metered だが本記事が paywall になる確率が高い
  "nytimes.com",
  "washingtonpost.com",
  // 日本語 paywall / 主要部分が premium
  "nikkei.com",
  "premium.nikkei.com",
  "diamond.jp",
  "toyokeizai.net",
]);

export function isPaywallUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (PAYWALL_DOMAINS.has(hostname)) return true;
    for (const domain of PAYWALL_DOMAINS) {
      if (hostname.endsWith(`.${domain}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const PAYWALL_HINT_FOR_PROMPT = [
  "ft.com",
  "wsj.com",
  "bloomberg.com",
  "economist.com",
  "newyorker.com",
  "foreignaffairs.com",
  "nytimes.com",
  "nikkei.com",
].join(", ");
