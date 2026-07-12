import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
import { youtubeVideoId } from "@/lib/youtube";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { title: rawTitle, youtubeUrl } = await request.json() as { title?: string; youtubeUrl?: string };
  const title = String(rawTitle || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  const videoId = youtubeUrl === undefined ? null : youtubeVideoId(String(youtubeUrl));
  if (youtubeUrl !== undefined && !videoId) return NextResponse.json({ error: "Masukkan pautan YouTube yang sah." }, { status: 400 });
  const { id } = await params;
  await ensureSchema();
  const rows = videoId
    ? await sql()`UPDATE youtube_videos SET title = ${title}, youtube_id = ${videoId} WHERE id = ${id} RETURNING id`
    : await sql()`UPDATE youtube_videos SET title = ${title} WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { id } = await params;
  await ensureSchema();
  const rows = await sql()`DELETE FROM youtube_videos WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
