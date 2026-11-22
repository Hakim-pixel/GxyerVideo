import { execFile } from "child_process";
import * as cheerio from "cheerio";

export interface FolderItem {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
}

export interface ExtractedVideo {
  success: boolean;
  isFolder?: boolean;
  folderTitle?: string;
  folderItems?: FolderItem[];
  title?: string;
  videoUrl?: string;
  type?: "hls" | "mp4" | "webm" | "iframe";
  thumbnail?: string;
  duration?: number;
  author?: string;
  formats?: Array<{
    format_id?: string;
    url: string;
    resolution?: string;
    quality?: string;
    ext?: string;
  }>;
  iframeUrl?: string;
  headers?: Record<string, string>;
  source?: "yt-dlp" | "direct-html" | "hls-regex" | "iframe-fallback" | "folder";
  error?: string;
}

// Unpack Dean Edwards / eval(function(p,a,c,k,e,d)...) packer commonly used on streaming sites
function unpackJs(packed: string): string {
  try {
    const match = packed.match(/eval\(function\(p,a,c,k,e,[rd]\)[\s\S]*?return p;?\}\s*\(([\s\S]*?)\)\)/);
    if (!match) return "";
    
    const argsString = match[1];
    const regex = /'((?:\\.|[^'])*)',\s*(\d+),\s*(\d+),\s*'((?:\\.|[^'])*)'/;
    const parts = argsString.match(regex);
    if (!parts) return "";

    let payload = parts[1];
    const radix = parseInt(parts[2], 10);
    const count = parseInt(parts[3], 10);
    const symtab = parts[4].split("|");

    if (symtab.length < count) return "";

    const decodeBase = (c: number): string => {
      const a = (c < radix ? "" : decodeBase(Math.floor(c / radix))) +
        ((c = c % radix) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
      return a;
    };

    for (let i = count - 1; i >= 0; i--) {
      const key = decodeBase(i);
      const val = symtab[i] || key;
      if (key !== val) {
        payload = payload.replace(new RegExp(`\\b${key}\\b`, "g"), val);
      }
    }
    return payload;
  } catch {
    return "";
  }
}

// Folder extractor (for filecoster.com/f/... or folder links)
export async function extractFolder(targetUrl: string): Promise<ExtractedVideo | null> {
  try {
    const isFolder = /\/f\/[a-zA-Z0-9_\-]+/i.test(targetUrl);
    if (!isFolder) return null;

    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    const folderTitle = $("title").text().replace(/^[^\w\s]+/, "").trim() || "Folder Video";

    const items: FolderItem[] = [];
    $("article.drive-file-card, article").each((_, el) => {
      const card = $(el);
      const link = card.find('a[href*="/d/"]').first();
      const href = link.attr("href") || "";
      const match = href.match(/\/d\/([a-zA-Z0-9_\-]+)/);
      if (!match) return;
      const id = match[1];
      const fullUrl = new URL(href, targetUrl).href;
      const thumbnail = card.find("img").attr("src");
      const title =
        card.find(".file-name").text().trim() ||
        link.attr("aria-label") ||
        card.find(".file-name").attr("title") ||
        `Video ${items.length + 1}`;

      items.push({ id, url: fullUrl, title, thumbnail });
    });

    if (items.length === 0) {
      const seen = new Set<string>();
      $('a[href*="/d/"]').each((_, el) => {
        const href = $(el).attr("href") || "";
        const match = href.match(/\/d\/([a-zA-Z0-9_\-]+)/);
        if (!match) return;
        const id = match[1];
        if (seen.has(id)) return;
        seen.add(id);
        const fullUrl = new URL(href, targetUrl).href;
        const thumbnail = $(el).find("img").attr("src");
        const title = $(el).text().trim() || $(el).attr("aria-label") || `Video ${items.length + 1}`;
        items.push({ id, url: fullUrl, title, thumbnail });
      });
    }

    if (items.length > 0) {
      return {
        success: true,
        isFolder: true,
        folderTitle,
        folderItems: items,
        source: "folder",
      };
    }

    return null;
  } catch (err) {
    console.error("Folder extraction error:", err);
    return null;
  }
}

// Dedicated resolver for Filecoster / Vidoy network single videos
export async function extractFilecoster(targetUrl: string): Promise<ExtractedVideo | null> {
  try {
    const isFilecoster = /filecoster\.com|vidoy\.(com|net|asia)/i.test(targetUrl);
    if (!isFilecoster) return null;

    // Step 1: fetch initial page
    const res1 = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res1.ok) return null;
    const html1 = await res1.text();

    const titleMatch = html1.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Video";

    const thumbMatch =
      html1.match(/class=["']thumbnail["'][^>]*src=["']([^"']+)["']/i) ||
      html1.match(/src=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i);
    const thumbnail = thumbMatch ? thumbMatch[1] : undefined;

    // Look for var SRC = '/ip129jk...' or similar
    const srcMatch =
      html1.match(/var\s+SRC\s*=\s*['"]([^'"]+)['"]/i) ||
      html1.match(/['"](\/ip[a-zA-Z0-9_\-?&=.]+)['"]/i);

    if (!srcMatch) return null;
    const ipUrl = new URL(srcMatch[1], targetUrl).href;

    // Step 2: fetch inner iframe page with Referer
    const res2 = await fetch(ipUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: targetUrl,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res2.ok) return null;
    const html2 = await res2.text();

    // Look for playerPath = "https://filecoster.com/stream.php?..." or rel="prefetch" href="..."
    const streamPathMatch =
      html2.match(/playerPath\s*=\s*["']([^"']+)["']/i) ||
      html2.match(/rel=["']prefetch["']\s+href=["']([^"']+)["']/i) ||
      html2.match(/href=["'](https?:\/\/[^"']*stream\.php[^"']*)["']/i);

    if (!streamPathMatch) return null;
    const streamUrl = streamPathMatch[1].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");

    // Step 3: fetch stream.php with Referer
    const res3 = await fetch(streamUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: ipUrl,
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res3.ok) return null;
    const html3 = await res3.text();

    // Step 4: look for <source src="..." /> or direct video link
    const sourceMatch =
      html3.match(/<source\s+src=["']([^"']+)["']/i) ||
      html3.match(/https?:\/\/[a-zA-Z0-9.\-_]*overfetch\.video\/[^\s"']+/i) ||
      html3.match(/https?:\/\/[^"'<>\s]+\.(?:mp4|m3u8)[^"'<>\s]*/i);

    if (!sourceMatch) return null;
    const rawVideoUrl = sourceMatch[1] || sourceMatch[0];

    // Proxy through our backend with Referer: https://filecoster.com/ so CORS & Hotlink protection are bypassed
    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(rawVideoUrl)}&referer=${encodeURIComponent("https://filecoster.com/")}`;

    return {
      success: true,
      title,
      videoUrl: proxiedUrl,
      type: rawVideoUrl.includes(".m3u8") ? "hls" : "mp4",
      thumbnail,
      source: "direct-html",
    };
  } catch (err) {
    console.error("Filecoster extraction error:", err);
    return null;
  }
}

// Try yt-dlp (handles 1000+ sites, decrypts streams, gets official media)
export async function extractWithYtDlp(targetUrl: string): Promise<ExtractedVideo | null> {
  // yt-dlp requires Python subprocess — not available on Vercel serverless
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return null;
  }
  return new Promise((resolve) => {
    const child = execFile(
      "python",
      ["-m", "yt_dlp", "--dump-single-json", "--no-warnings", "--no-playlist", targetUrl],
      { timeout: 18000, maxBuffer: 10 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) {
          resolve(null);
          return;
        }

        try {
          const data = JSON.parse(stdout);
          const title = data.title || "Video";
          const thumbnail = data.thumbnail || (data.thumbnails && data.thumbnails[0]?.url);
          const duration = data.duration;
          const author = data.uploader || data.channel;

          let videoUrl = data.url;
          let type: "hls" | "mp4" | "webm" = "mp4";

          if (videoUrl?.includes(".m3u8") || data.protocol?.includes("m3u8")) {
            type = "hls";
          } else if (videoUrl?.includes(".webm") || data.ext === "webm") {
            type = "webm";
          }

          const playableFormats: Array<{ format_id?: string; url: string; resolution?: string; quality?: string; ext?: string }> = [];
          if (Array.isArray(data.formats)) {
            for (const f of data.formats) {
              if (f.url && (f.vcodec !== "none" || f.protocol?.includes("m3u8"))) {
                playableFormats.push({
                  format_id: f.format_id,
                  url: f.url,
                  resolution: f.resolution || (f.height ? `${f.height}p` : undefined),
                  quality: f.format_note,
                  ext: f.ext,
                });
              }
            }
          }

          if (!videoUrl && playableFormats.length > 0) {
            const best = playableFormats[playableFormats.length - 1];
            videoUrl = best.url;
            if (videoUrl.includes(".m3u8")) type = "hls";
          }

          if (videoUrl) {
            resolve({
              success: true,
              title,
              videoUrl,
              type,
              thumbnail,
              duration,
              author,
              formats: playableFormats.slice(-5),
              source: "yt-dlp",
            });
            return;
          }
        } catch {
          // parse failed
        }
        resolve(null);
      }
    );

    child.on("error", () => resolve(null));
  });
}

// Fallback: Parse HTML directly (Cheerio, regex, JWPlayer / VideoJS search)
export async function extractWithHtmlParser(targetUrl: string): Promise<ExtractedVideo | null> {
  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id,en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").text().trim() ||
      "Video Player";
    const thumbnail =
      $('meta[property="og:image"]').attr("content") ||
      $('link[rel="image_src"]').attr("href");

    // Check direct <video> or <source>
    const directVideo = $("video source").attr("src") || $("video").attr("src");
    if (directVideo) {
      const fullUrl = new URL(directVideo, targetUrl).href;
      return {
        success: true,
        title,
        videoUrl: fullUrl,
        type: fullUrl.includes(".m3u8") ? "hls" : "mp4",
        thumbnail,
        source: "direct-html",
      };
    }

    // Search for m3u8 in all script tags
    const m3u8Regex = /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/i;
    const mp4Regex = /https?:\/\/[^"'\s<>]+\.mp4[^"'\s<>]*/i;

    const scripts = $("script")
      .map((_, el) => $(el).html() || "")
      .get()
      .join("\n");

    let match = scripts.match(m3u8Regex);
    if (match) {
      return {
        success: true,
        title,
        videoUrl: match[0],
        type: "hls",
        thumbnail,
        source: "hls-regex",
      };
    }

    const unpacked = unpackJs(scripts);
    if (unpacked) {
      match = unpacked.match(m3u8Regex) || unpacked.match(mp4Regex);
      if (match) {
        return {
          success: true,
          title,
          videoUrl: match[0],
          type: match[0].includes(".m3u8") ? "hls" : "mp4",
          thumbnail,
          source: "hls-regex",
        };
      }
    }

    match = scripts.match(mp4Regex);
    if (match) {
      return {
        success: true,
        title,
        videoUrl: match[0],
        type: "mp4",
        thumbnail,
        source: "direct-html",
      };
    }

    const iframeSrc = $("iframe").first().attr("src");
    if (iframeSrc && !iframeSrc.includes("google") && !iframeSrc.includes("ad")) {
      const fullIframe = new URL(iframeSrc, targetUrl).href;
      return {
        success: true,
        title,
        iframeUrl: fullIframe,
        type: "iframe",
        thumbnail,
        source: "iframe-fallback",
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Master extraction function
export async function extractVideo(url: string): Promise<ExtractedVideo> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { success: false, error: "URL tidak boleh kosong." };
  }

  // Check if it's already a direct video stream link
  if (trimmed.match(/\.(mp4|webm|mkv)(\?.*)?$/i)) {
    return {
      success: true,
      title: "Direct Video Stream",
      videoUrl: trimmed,
      type: trimmed.includes(".webm") ? "webm" : "mp4",
      source: "direct-html",
    };
  }
  if (trimmed.match(/\.m3u8(\?.*)?$/i)) {
    return {
      success: true,
      title: "Direct HLS Stream",
      videoUrl: trimmed,
      type: "hls",
      source: "direct-html",
    };
  }

  // 1. Check if it's a folder / playlist URL (e.g. filecoster.com/f/...)
  const folderResult = await extractFolder(trimmed);
  if (folderResult && folderResult.isFolder) {
    return folderResult;
  }

  // 2. Try dedicated Filecoster / Vidoy network single video extractor
  const filecosterResult = await extractFilecoster(trimmed);
  if (filecosterResult && filecosterResult.videoUrl) {
    return filecosterResult;
  }

  // 3. Try yt-dlp
  const ytdlpResult = await extractWithYtDlp(trimmed);
  if (ytdlpResult && ytdlpResult.videoUrl) {
    return ytdlpResult;
  }

  // 4. Try HTML scraping and regex
  const htmlResult = await extractWithHtmlParser(trimmed);
  if (htmlResult) {
    return htmlResult;
  }

  // 5. Fallback to sandboxed iframe embed
  return {
    success: true,
    title: "Sandboxed Player View",
    iframeUrl: trimmed,
    type: "iframe",
    source: "iframe-fallback",
  };
}
