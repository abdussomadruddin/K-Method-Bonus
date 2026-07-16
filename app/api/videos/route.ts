/* eslint-disable @next/next/no-assign-module-variable, @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
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
async function attachGroups(videoId: string, groupIds: string[]) {
  for (const groupId of groupIds) {
    const module = await sql()`SELECT id FROM group_modules WHERE group_id = ${groupId} ORDER BY sort_order ASC LIMIT 1`;
    const next = await sql()`SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM video_groups WHERE group_id = ${groupId} AND module_id = ${module[0].id}`;
    await sql()`INSERT INTO video_groups (video_id, group_id, module_id, sort_order) VALUES (${videoId}, ${groupId}, ${module[0].id}, ${Number(next[0].value)}) ON CONFLICT DO NOTHING`;
  }
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema();
  const rows = session.role === "admin"
    ? await sql()`SELECT id, title, youtube_id, created_at FROM youtube_videos ORDER BY created_at DESC`
    : await sql()`SELECT v.id, v.title, v.youtube_id, v.created_at, gm.id AS module_id, gm.title AS module_title, gm.sort_order AS module_order FROM youtube_videos v JOIN video_groups vg ON vg.video_id = v.id JOIN group_modules gm ON gm.id = vg.module_id WHERE vg.group_id = ${session.groupId} ORDER BY gm.sort_order ASC, vg.sort_order ASC, v.created_at DESC`;
  const videoIds = rows.map((row: any) => row.id);
  const memberships = session.role === "admin" && videoIds.length
    ? await sql()`SELECT vg.video_id, g.id AS group_id, g.name AS group_name FROM video_groups vg JOIN access_groups g ON g.id = vg.group_id WHERE vg.video_id = ANY(${videoIds})`
    : [];
  const groupsByVideo = new Map<string, { id: string; name: string }[]>();
  for (const membership of memberships) groupsByVideo.set(membership.video_id, [...(groupsByVideo.get(membership.video_id) || []), { id: membership.group_id, name: membership.group_name }]);
  return NextResponse.json({ videos: rows.map((row: any) => ({ id: row.id, title: row.title, youtubeId: row.youtube_id, createdAt: row.created_at, groups: groupsByVideo.get(row.id) || [], module: session.role === "student" ? { id: row.module_id, title: row.module_title, sortOrder: Number(row.module_order) } : undefined })) });
}

export async function POST(request: NextRequest) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { title: rawTitle, youtubeUrl, groupIds: rawGroupIds } = await request.json() as { title?: string; youtubeUrl?: string; groupIds?: unknown };
  const title = String(rawTitle || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  const videoId = youtubeVideoId(String(youtubeUrl || ""));
  if (!videoId) return NextResponse.json({ error: "Masukkan pautan YouTube yang sah." }, { status: 400 });
  await ensureSchema(); const groupIds = await validGroupIds(rawGroupIds ?? []);
  if (!groupIds) return NextResponse.json({ error: "Group video tidak sah." }, { status: 400 });
  const id = randomUUID();
  try {
    const rows = await sql()`INSERT INTO youtube_videos (id, title, youtube_id) VALUES (${id}, ${title}, ${videoId}) RETURNING id, title, youtube_id, created_at`;
    await attachGroups(id, groupIds);
    const video = rows[0]; return NextResponse.json({ video: { id: video.id, title: video.title, youtubeId: video.youtube_id, createdAt: video.created_at, groups: [] } }, { status: 201 });
  } catch (error) { if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "Video YouTube ini sudah ditambah." }, { status: 409 }); throw error; }
}
