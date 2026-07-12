import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
import { youtubeVideoId } from "@/lib/youtube";

export async function GET() {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema();
  const rows = await sql()`SELECT id, title, youtube_id, created_at FROM youtube_videos ORDER BY created_at DESC`;
  const videos = rows.map((row) => ({ id: row.id, title: row.title, youtubeId: row.youtube_id, createdAt: row.created_at }));
  return NextResponse.json({ videos });
}

export async function POST(request: NextRequest) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { title: rawTitle, youtubeUrl } = await request.json() as { title?: string; youtubeUrl?: string };
  const title = String(rawTitle || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  const videoId = youtubeVideoId(String(youtubeUrl || ""));
  if (!videoId) return NextResponse.json({ error: "Masukkan pautan YouTube yang sah." }, { status: 400 });
  await ensureSchema();
  try {
    const rows = await sql()`INSERT INTO youtube_videos (id, title, youtube_id) VALUES (${randomUUID()}, ${title}, ${videoId}) RETURNING id, title, youtube_id, created_at`;
    const video = rows[0];
    return NextResponse.json({ video: { id: video.id, title: video.title, youtubeId: video.youtube_id, createdAt: video.created_at } }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Video YouTube ini sudah ditambah." }, { status: 409 });
    throw error;
  }
}
