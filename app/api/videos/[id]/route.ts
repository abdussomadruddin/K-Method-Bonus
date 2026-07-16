import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
import { youtubeVideoId } from "@/lib/youtube";

async function validGroupIds(groupIds: unknown) {
  if (!Array.isArray(groupIds) || groupIds.some((id) => typeof id !== "string")) return null;
  const ids = [...new Set(groupIds)];
  if (!ids.length) return ids;
  const rows = await sql()`SELECT id FROM access_groups WHERE id = ANY(${ids})`;
  return rows.length === ids.length ? ids : null;
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const body = await request.json() as { title?: string; youtubeUrl?: string; groupIds?: unknown };
  const title = String(body.title || "").trim(); if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  const videoId = body.youtubeUrl === undefined ? null : youtubeVideoId(String(body.youtubeUrl));
  if (body.youtubeUrl !== undefined && !videoId) return NextResponse.json({ error: "Masukkan pautan YouTube yang sah." }, { status: 400 });
  await ensureSchema(); const groupIds = body.groupIds === undefined ? undefined : await validGroupIds(body.groupIds);
  if (groupIds === null) return NextResponse.json({ error: "Group video tidak sah." }, { status: 400 });
  const { id } = await params;
  const rows = videoId ? await sql()`UPDATE youtube_videos SET title = ${title}, youtube_id = ${videoId} WHERE id = ${id} RETURNING id` : await sql()`UPDATE youtube_videos SET title = ${title} WHERE id = ${id} RETURNING id`;
  if (!rows[0]) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  if (groupIds !== undefined) { await sql()`DELETE FROM video_groups WHERE video_id = ${id}`; for (const groupId of groupIds) await sql()`INSERT INTO video_groups (video_id, group_id) VALUES (${id}, ${groupId})`; }
  return NextResponse.json({ ok: true });
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  await ensureSchema(); const { id } = await params;
  const rows = await sql()`DELETE FROM youtube_videos WHERE id = ${id} RETURNING id`;
  return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
}
