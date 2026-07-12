import { NextRequest, NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";

const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX = 500 * 1024 * 1024;

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema();
  const videos = await sql()`SELECT id, title, filename, content_type as "contentType", size, created_at as "createdAt" FROM videos ORDER BY created_at DESC`;
  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX + 1024 * 1024) return NextResponse.json({ error: "Fail melebihi had 500 MB." }, { status: 413 });
  const form = await request.formData(); const title = String(form.get("title") || "").trim(); const file = form.get("video");
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  if (!(file instanceof File) || !TYPES.has(file.type)) return NextResponse.json({ error: "Gunakan fail MP4, WebM atau MOV." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Fail melebihi had 500 MB." }, { status: 413 });
  await ensureSchema();
  const id = crypto.randomUUID(); const createdAt = new Date().toISOString();
  const blob = await put(`videos/${id}/${file.name}`, file, { access: "private", contentType: file.type, addRandomSuffix: false });
  try {
    await sql()`INSERT INTO videos (id,title,filename,content_type,size,object_url,created_at) VALUES (${id},${title},${file.name},${file.type},${file.size},${blob.url},${createdAt})`;
  } catch (error) { await del(blob.url); throw error; }
  return NextResponse.json({ id, title }, { status: 201 });
}
