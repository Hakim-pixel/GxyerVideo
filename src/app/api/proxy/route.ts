import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 25;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  let targetUrl = searchParams.get("url");
  const referer = searchParams.get("referer");

  if (!targetUrl) {
    return new NextResponse("URL parameter is required", { status: 400 });
  }

  // Prevent recursive /api/proxy?url=/api/proxy...
  while (targetUrl.startsWith("/api/proxy?url=")) {
    const decoded = decodeURIComponent(targetUrl.replace("/api/proxy?url=", ""));
    targetUrl = decoded.split("&")[0];
  }

  try {
    const range = req.headers.get("range");
    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };

    if (referer) {
      headers["Referer"] = referer;
    }
    if (range) {
      headers["Range"] = range;
    }

    const response = await fetch(targetUrl, {
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const isM3u8 =
      targetUrl.includes(".m3u8") ||
      contentType.includes("mpegurl") ||
      contentType.includes("application/x-mpegURL");

    // If it's an M3U8 manifest, rewrite relative segment & sub-playlist URLs through proxy
    if (isM3u8 && response.ok) {
      const text = await response.text();
      const baseUrl = targetUrl;

      const rewritten = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // Rewrite URI in #EXT-X-KEY
          if (trimmed.startsWith("#EXT-X-KEY") && trimmed.includes('URI="')) {
            return trimmed.replace(/URI="([^"]+)"/, (_, uri) => {
              const fullKeyUrl = new URL(uri, baseUrl).href;
              const proxiedKey = `/api/proxy?url=${encodeURIComponent(fullKeyUrl)}&referer=${encodeURIComponent(referer || "")}`;
              return `URI="${proxiedKey}"`;
            });
          }

          // If it's a comment or directive, leave untouched
          if (trimmed.startsWith("#")) return line;

          // Otherwise, it's a segment (.ts) or sub-playlist (.m3u8) URL
          const fullMediaUrl = new URL(trimmed, baseUrl).href;
          return `/api/proxy?url=${encodeURIComponent(fullMediaUrl)}&referer=${encodeURIComponent(referer || "")}`;
        })
        .join("\n");

      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
          "Cache-Control": "no-cache",
        },
      });
    }

    // For standard binary/ts/mp4 files, stream the body with Range headers
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");

    [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "content-disposition",
      "cache-control",
    ].forEach((header) => {
      const val = response.headers.get(header);
      if (val) responseHeaders.set(header, val);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Proxy error";
    return new NextResponse(`Proxy error: ${msg}`, { status: 502 });
  }
}
