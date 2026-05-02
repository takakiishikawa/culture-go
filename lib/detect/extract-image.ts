// 記事ページの og:image / twitter:image を抜く軽量フェッチャ。
// head 部だけ読めば十分なので 64KB で打ち切る。

const HEAD_BYTES = 64 * 1024;

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
];

export async function fetchOgImage(
  pageUrl: string,
  timeoutMs = 5000,
): Promise<string | null> {
  if (!pageUrl) return null;
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; culturego-bot/1.0; +https://culture-go.vercel.app)",
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok || !res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: false });
    let buffer = "";
    let received = 0;
    while (received < HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      received += value.byteLength;
      if (buffer.includes("</head>")) break;
    }
    await reader.cancel().catch(() => undefined);

    for (const re of META_PATTERNS) {
      const found = buffer.match(re)?.[1];
      if (!found) continue;
      try {
        return new URL(found, pageUrl).toString();
      } catch {
        if (found.startsWith("http")) return found;
      }
    }
    return null;
  } catch {
    return null;
  }
}
