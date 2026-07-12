import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { driveFile, listDriveVideos, saveDriveVideo } from "@/lib/google-drive";

const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const files = await listDriveVideos();
  const videos = files.filter((file) => TYPES.has(file.mimeType)).map((file) => ({
    id: file.id,
    title: file.appProperties?.lmsTitle || file.name,
    filename: file.name,
    contentType: file.mimeType,
    size: Number(file.size),
    createdAt: file.createdTime,
  }));
  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { title: rawTitle, driveFileId } = await request.json() as { title?: string; driveFileId?: string };
  const title = String(rawTitle || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  if (!driveFileId) return NextResponse.json({ error: "Muat naik video belum selesai." }, { status: 400 });
  const file = await driveFile(driveFileId);
  if (!TYPES.has(file.mimeType)) return NextResponse.json({ error: "Gunakan fail MP4, WebM atau MOV." }, { status: 400 });
  const saved = await saveDriveVideo(file.id, title);
  return NextResponse.json({ id: saved.id, title }, { status: 201 });
}
