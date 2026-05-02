// 記事ページから写真を取りに行く（外部 API 不使用）。
// 一次: og:image / twitter:image / itemprop=image を head から拾う（多くのニュース系の本命）
// 二次: 拾えなかったら body 内の <img> を走査して最初の "意味のある" 画像を返す

const ARTICLE_BYTES = 512 * 1024; // 500KB 読めば本文の最初の画像までは届く想定

export async function fetchOgImage(
  pageUrl: string,
  timeoutMs = 10000,
): Promise<string | null> {
  if (!pageUrl) return null;

  const html = await fetchHtml(pageUrl, timeoutMs);
  if (!html) return null;

  const fromMeta = findFromMeta(html);
  if (fromMeta) return resolveUrl(fromMeta, pageUrl);

  const fromBody = findFromBody(html);
  if (fromBody) return resolveUrl(fromBody, pageUrl);

  return null;
}

async function fetchHtml(
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
    let html = "";
    let received = 0;
    while (received < ARTICLE_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
    await reader.cancel().catch(() => undefined);
    return html;
  } catch {
    return null;
  }
}

// ── meta タグ系 ─────────────────────────────────────────────────────
function findFromMeta(html: string): string | null {
  return (
    findMeta(html, "property", "og:image:secure_url") ??
    findMeta(html, "property", "og:image:url") ??
    findMeta(html, "property", "og:image") ??
    findMeta(html, "name", "og:image") ??
    findMeta(html, "name", "twitter:image:src") ??
    findMeta(html, "name", "twitter:image") ??
    findMeta(html, "itemprop", "image")
  );
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

// ── 本文内の <img> 走査 ─────────────────────────────────────────────
const IGNORE_PATTERNS =
  /\b(logo|favicon|sprite|avatar|pixel|tracking|advert|sponsor|emoji|button|placeholder|spinner|loader|share|social)\b/i;

function findFromBody(html: string): string | null {
  const bodyStart = html.search(/<body\b/i);
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html;

  const imgPattern = /<img\b[^>]*>/gi;
  for (const match of body.matchAll(imgPattern)) {
    const tag = match[0];

    // データ系属性も拾う（lazy-load 対応）
    const candidates = [
      pickFromSrcset(attr(tag, "srcset")),
      pickFromSrcset(attr(tag, "data-srcset")),
      attr(tag, "data-src"),
      attr(tag, "data-original"),
      attr(tag, "data-lazy-src"),
      attr(tag, "src"),
    ].filter((s): s is string => Boolean(s));

    for (const src of candidates) {
      if (src.startsWith("data:")) continue;
      if (IGNORE_PATTERNS.test(tag)) continue;
      if (IGNORE_PATTERNS.test(src)) continue;

      // 寸法が分かる場合、極小は除外（tracking pixel / icon）
      const w = parseDim(attr(tag, "width"));
      const h = parseDim(attr(tag, "height"));
      if (w !== null && w < 200) continue;
      if (h !== null && h < 100) continue;

      // svg / 1x1.gif など装飾系は除外
      if (/\.svg(\?|$)/i.test(src)) continue;
      if (/\b1x1\.(gif|png)\b/i.test(src)) continue;

      return src;
    }
  }
  return null;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return tag.match(re)?.[1] ?? null;
}

function pickFromSrcset(srcset: string | null): string | null {
  if (!srcset) return null;
  const parts = srcset.split(",").map((s) => s.trim());
  const candidates: { url: string; weight: number }[] = [];
  for (const p of parts) {
    const [url, descriptor] = p.split(/\s+/);
    if (!url) continue;
    let weight = 1;
    if (descriptor) {
      const m = descriptor.match(/^(\d+(?:\.\d+)?)([wx])$/);
      if (m) weight = parseFloat(m[1]);
    }
    candidates.push({ url, weight });
  }
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0]?.url ?? null;
}

function parseDim(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveUrl(src: string, baseUrl: string): string | null {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src.startsWith("http") ? src : null;
  }
}
