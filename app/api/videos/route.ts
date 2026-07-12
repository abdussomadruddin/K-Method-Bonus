import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
import { driveFile } from "@/lib/google-drive";

const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema();
  const videos = await sql()`SELECT id, title, filename, content_type as "contentType", size, created_at as "createdAt" FROM videos ORDER BY created_at DESC`;
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
  await ensureSchema();
  const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
  await sql()`INSERT INTO videos (id,title,filename,content_type,size,object_url,created_at) VALUES (${id},${title},${file.name},${file.mimeType},${Number(file.size)},${file.id},${createdAt})`;
  return NextResponse.json({ id, title }, { status: 201 });
}
