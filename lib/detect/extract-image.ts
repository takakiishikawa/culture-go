// 記事ページから写真を取りに行く（外部 API 不使用）。
// 一次: og:image / twitter:image / itemprop=image を head から拾う（多くのニュース系の本命）
//        ただし「ブランド汎用シェア画像」(SocialShare / DefaultOG / og-default 等) は
//        記事固有性が無いので skip し、本文 img を優先する。
// 二次: body 内の <img> を走査して最初の "意味のある" 画像を返す
// 三次: それでもダメなら一次で skip した generic og:image を最後の砦として返す
// 四次: fetchUnsplashImage で英語キーワード検索 (run.ts 側、要 UNSPLASH_ACCESS_KEY)

const ARTICLE_BYTES = 512 * 1024; // 500KB 読めば本文の最初の画像までは届く想定

// 「記事固有でない汎用ブランド画像」のファイル名パターン。
// publisher が SNS シェア用に作った flat なテンプレ画像 (例:
// eurasiagroup の SocialShare1200x630.png)。記事写真として使うと
// ベタ塗りに見える。
// \b は数字続き ("SocialShare1200") でマッチしないので使わない。
const GENERIC_OG_FILENAME =
  /(socialshare|social[-_]share|defaultog|default[-_]og|og[-_]default|generic[-_]share|brand[-_]?card|share[-_]image|default[-_]share|opengraph[-_]default|og[-_]image[-_]default)/i;

function isGenericOgUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    const filename = path.substring(path.lastIndexOf("/") + 1);
    return GENERIC_OG_FILENAME.test(filename);
  } catch {
    return GENERIC_OG_FILENAME.test(url);
  }
}

export async function fetchOgImage(
  pageUrl: string,
  timeoutMs = 10000,
): Promise<string | null> {
  if (!pageUrl) return null;

  const html = await fetchHtml(pageUrl, timeoutMs);
  if (!html) return null;

  const fromMeta = findFromMeta(html);
  const ogIsGeneric = fromMeta != null && isGenericOgUrl(fromMeta);

  // 通常: og:image を最優先
  if (fromMeta && !ogIsGeneric) return resolveUrl(fromMeta, pageUrl);

  // og:image がブランド汎用 → 本文 img を優先
  const fromBody = findFromBody(html);
  if (fromBody) return resolveUrl(fromBody, pageUrl);

  // 本文 img も無いなら最後の砦として generic og:image を返す
  if (fromMeta) return resolveUrl(fromMeta, pageUrl);

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

// 埋め込み (動画 / SNS) のサムネは記事本体と無関係なので除外。
// 例: i.ytimg.com (YouTube), i.vimeocdn.com (Vimeo), pbs.twimg.com (X 引用),
//     scontent-*.cdninstagram.com (IG), gravatar.com (Wp コメント avatar)
const EMBED_THUMB_HOSTS =
  /\b(i\.ytimg\.com|img\.youtube\.com|youtu\.be|i\.vimeocdn\.com|player\.vimeo\.com|pbs\.twimg\.com|video\.twimg\.com|abs\.twimg\.com|cdninstagram\.com|fbcdn\.net|gravatar\.com|secure\.gravatar\.com|disquscdn\.com|widget\.amazon)\b/i;

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
      // 埋め込み (YouTube / Vimeo / X / IG / Gravatar 等) のサムネは記事と関係ないため除外。
      if (EMBED_THUMB_HOSTS.test(src)) continue;

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

// ── Unsplash フォールバック ───────────────────────────────────────────
// og:image と本文 img の両方が取れなかった時の代替画像。
// 英語キーワード検索 (Unsplash API)。固有名詞より象徴語が向く。
// UNSPLASH_ACCESS_KEY が無ければ静かに null を返す。
export async function fetchUnsplashImage(
  query: string,
  timeoutMs = 8000,
): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query.trim()) return null;

  try {
    const url =
      "https://api.unsplash.com/search/photos" +
      `?query=${encodeURIComponent(query)}` +
      "&per_page=1&orientation=landscape&content_filter=high";
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ urls?: { regular?: string; full?: string } }>;
    };
    const photo = data.results?.[0]?.urls;
    return photo?.regular ?? photo?.full ?? null;
  } catch {
    return null;
  }
}
