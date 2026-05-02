// 記事ページから写真を取りに行く。
// 一次: Microlink API（bot 対策込みで og:image を解決してくれる、無料枠で十分）。
// 二次: 自前で head の meta タグを舐めて og:image / twitter:image / itemprop=image を拾う。

const MICROLINK_API = "https://api.microlink.io";
const HEAD_BYTES = 96 * 1024;

export async function fetchOgImage(
  pageUrl: string,
  timeoutMs = 12000,
): Promise<string | null> {
  if (!pageUrl) return null;

  const fromMicrolink = await fetchViaMicrolink(pageUrl, timeoutMs);
  if (fromMicrolink) return fromMicrolink;

  return fetchViaDirect(pageUrl, timeoutMs);
}

async function fetchViaMicrolink(
  pageUrl: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const apiUrl = `${MICROLINK_API}/?url=${encodeURIComponent(pageUrl)}&audio=false&video=false`;
    const res = await fetch(apiUrl, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status?: string;
      data?: { image?: { url?: string } };
    };
    if (json.status !== "success") return null;
    const url = json.data?.image?.url;
    return url && url.startsWith("http") ? url : null;
  } catch {
    return null;
  }
}

function findMeta(html: string, attribute: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(
    `<meta\\b[^>]*\\b${attribute}\\s*=\\s*["']${escaped}["'][^>]*\\bcontent\\s*=\\s*["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta\\b[^>]*\\bcontent\\s*=\\s*["']([^"']+)["'][^>]*\\b${attribute}\\s*=\\s*["']${escaped}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

async function fetchViaDirect(
  pageUrl: string,
  timeoutMs: number,
): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ja;q=0.8",
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
      if (/<\/head\s*>/i.test(buffer)) break;
    }
    await reader.cancel().catch(() => undefined);

    const found =
      findMeta(buffer, "property", "og:image:secure_url") ??
      findMeta(buffer, "property", "og:image:url") ??
      findMeta(buffer, "property", "og:image") ??
      findMeta(buffer, "name", "og:image") ??
      findMeta(buffer, "name", "twitter:image:src") ??
      findMeta(buffer, "name", "twitter:image") ??
      findMeta(buffer, "itemprop", "image");

    if (!found) return null;
    try {
      return new URL(found, pageUrl).toString();
    } catch {
      return found.startsWith("http") ? found : null;
    }
  } catch {
    return null;
  }
}
