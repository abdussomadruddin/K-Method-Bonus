import { NextRequest, NextResponse } from "next/server";
import { expectedPassword, readSession, safeEqual } from "@/lib/auth";
import { decryptGroupPassword, encryptGroupPassword } from "@/lib/group-password";
import { ensureSchema, sql } from "@/lib/runtime";

const noStore = { "Cache-Control": "no-store" };
async function validateName(value: unknown, id: string) {
  const name = String(value || "").trim(); if (!name || name.length > 80) return null;
  const duplicate = await sql()`SELECT id FROM access_groups WHERE LOWER(name) = LOWER(${name}) AND id <> ${id}`;
  return duplicate[0] ? null : name;
}
async function validatePassword(value: unknown, id: string) {
  const password = typeof value === "string" ? value : "";
  if (password.length < 6 || password.length > 100 || safeEqual(password, expectedPassword("admin"))) return null;
  const groups = await sql()`SELECT id, password_ciphertext, password_iv FROM access_groups WHERE id <> ${id}`;
  for (const group of groups) if (safeEqual(password, await decryptGroupPassword(group.password_ciphertext, group.password_iv))) return null;
  return password;
}
async function validateVideoIds(value: unknown) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) return null;
  const ids = [...new Set(value)]; if (!ids.length) return ids;
  const rows = await sql()`SELECT id FROM youtube_videos WHERE id = ANY(${ids})`;
  return rows.length === ids.length ? ids : null;
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers: noStore });
  await ensureSchema(); const { id } = await params; const exists = await sql()`SELECT id FROM access_groups WHERE id = ${id}`;
  if (!exists[0]) return NextResponse.json({ error: "Group tidak ditemui." }, { status: 404, headers: noStore });
  const body = await request.json() as { name?: unknown; password?: unknown; videoIds?: unknown };
  if (body.name !== undefined) { const name = await validateName(body.name, id); if (!name) return NextResponse.json({ error: "Nama group tidak sah atau telah digunakan." }, { status: 400, headers: noStore }); await sql()`UPDATE access_groups SET name = ${name} WHERE id = ${id}`; }
  if (body.password !== undefined) { const password = await validatePassword(body.password, id); if (!password) return NextResponse.json({ error: "Password mesti 6–100 aksara, unik dan berbeza daripada password admin." }, { status: 400, headers: noStore }); const encrypted = await encryptGroupPassword(password); await sql()`UPDATE access_groups SET password_ciphertext = ${encrypted.ciphertext}, password_iv = ${encrypted.iv}, session_version = session_version + 1 WHERE id = ${id}`; }
  if (body.videoIds !== undefined) { const videoIds = await validateVideoIds(body.videoIds); if (!videoIds) return NextResponse.json({ error: "Pilihan video tidak sah." }, { status: 400, headers: noStore }); await sql()`DELETE FROM video_groups WHERE group_id = ${id}`; for (const videoId of videoIds) await sql()`INSERT INTO video_groups (video_id, group_id) VALUES (${videoId}, ${id})`; }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers: noStore });
  await ensureSchema(); const { id } = await params;
  const rows = await sql()`DELETE FROM access_groups WHERE id = ${id} RETURNING id`;
  return rows[0] ? NextResponse.json({ ok: true }, { headers: noStore }) : NextResponse.json({ error: "Group tidak ditemui." }, { status: 404, headers: noStore });
}
