import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
const headers = { "Cache-Control": "no-store" };
async function validVideos(value: unknown) { if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) return null; const ids = [...new Set(value)]; if (!ids.length) return ids; const rows = await sql()`SELECT id FROM youtube_videos WHERE id = ANY(${ids})`; return rows.length === ids.length ? ids : null; }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; moduleId: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers });
  await ensureSchema(); const { id: groupId, moduleId } = await params; const module = await sql()`SELECT id FROM group_modules WHERE id = ${moduleId} AND group_id = ${groupId}`; if (!module[0]) return NextResponse.json({ error: "Modul tidak ditemui." }, { status: 404, headers });
  const body = await request.json() as { title?: unknown; videoIds?: unknown };
  if (body.title !== undefined) { const title = String(body.title || "").trim(); if (!title || title.length > 100) return NextResponse.json({ error: "Tajuk modul mesti 1 hingga 100 aksara." }, { status: 400, headers }); await sql()`UPDATE group_modules SET title = ${title} WHERE id = ${moduleId}`; }
  if (body.videoIds !== undefined) { const videoIds = await validVideos(body.videoIds); if (!videoIds) return NextResponse.json({ error: "Video modul tidak sah." }, { status: 400, headers }); const fallback = await sql()`SELECT id FROM group_modules WHERE group_id = ${groupId} AND id <> ${moduleId} ORDER BY sort_order ASC LIMIT 1`; if (fallback[0]) await sql()`UPDATE video_groups SET module_id = ${fallback[0].id} WHERE group_id = ${groupId} AND module_id = ${moduleId}`; for (const [index, videoId] of videoIds.entries()) await sql()`INSERT INTO video_groups (video_id, group_id, module_id, sort_order) VALUES (${videoId}, ${groupId}, ${moduleId}, ${index}) ON CONFLICT (video_id, group_id) DO UPDATE SET module_id = ${moduleId}, sort_order = ${index}`; }
  return NextResponse.json({ ok: true }, { headers });
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; moduleId: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers });
  await ensureSchema(); const { id: groupId, moduleId } = await params; const all = await sql()`SELECT id FROM group_modules WHERE group_id = ${groupId} ORDER BY sort_order ASC`; if (all.length <= 1) return NextResponse.json({ error: "Setiap group mesti mempunyai sekurang-kurangnya satu modul." }, { status: 400, headers });
  const fallback = all.find((module: any) => module.id !== moduleId); await sql()`UPDATE video_groups SET module_id = ${fallback!.id} WHERE group_id = ${groupId} AND module_id = ${moduleId}`; const rows = await sql()`DELETE FROM group_modules WHERE id = ${moduleId} AND group_id = ${groupId} RETURNING id`;
  return rows[0] ? NextResponse.json({ ok: true }, { headers }) : NextResponse.json({ error: "Modul tidak ditemui." }, { status: 404, headers });
}
