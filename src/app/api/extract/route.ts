import { NextRequest, NextResponse } from "next/server";
import { extractVideo } from "@/lib/extractor";

export const maxDuration = 25;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { success: false, error: "Silakan masukkan URL video yang valid." },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Format URL tidak valid. Pastikan diawali http:// atau https://" },
        { status: 400 }
      );
    }

    const result = await extractVideo(url);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses video.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
