import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { startDriveUpload } from "@/lib/google-drive";

const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { filename, contentType, size, thumbnail } = await request.json() as { filename?: string; contentType?: string; size?: number; thumbnail?: string };
  if (!filename || !contentType || typeof size !== "number" || !Number.isFinite(size) || size <= 0 || !TYPES.has(contentType)) return NextResponse.json({ error: "Gunakan fail MP4, WebM atau MOV yang sah." }, { status: 400 });
  const safeThumbnail = typeof thumbnail === "string" && /^[A-Za-z0-9+/=]+$/.test(thumbnail) && thumbnail.length <= 1_500_000 ? thumbnail : undefined;
  return NextResponse.json({ uploadUrl: await startDriveUpload(filename, contentType, size, safeThumbnail) });
}
