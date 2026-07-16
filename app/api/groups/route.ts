/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { expectedPassword, readSession, safeEqual } from "@/lib/auth";
import { decryptGroupPassword, encryptGroupPassword } from "@/lib/group-password";
import { ensureSchema, sql } from "@/lib/runtime";

const noStore = { "Cache-Control": "no-store" };
async function groupsWithPasswords() {
  const rows = await sql()`SELECT id, name, password_ciphertext, password_iv, session_version, created_at FROM access_groups ORDER BY created_at ASC`;
  return Promise.all(rows.map(async (group: any) => ({ id: group.id, name: group.name, password: await decryptGroupPassword(group.password_ciphertext, group.password_iv), version: Number(group.session_version), createdAt: group.created_at })));
}
async function validName(name: unknown, omitId?: string) {
  const value = String(name || "").trim();
  if (!value || value.length > 80) return null;
  const duplicate = omitId ? await sql()`SELECT id FROM access_groups WHERE LOWER(name) = LOWER(${value}) AND id <> ${omitId}` : await sql()`SELECT id FROM access_groups WHERE LOWER(name) = LOWER(${value})`;
  return duplicate[0] ? null : value;
}
async function validPassword(password: unknown, omitId?: string) {
  const value = typeof password === "string" ? password : "";
  if (value.length < 6 || value.length > 100 || safeEqual(value, expectedPassword("admin"))) return null;
  for (const group of await groupsWithPasswords()) if (group.id !== omitId && safeEqual(value, group.password)) return null;
  return value;
}
async function validVideoIds(videoIds: unknown) {
  if (!Array.isArray(videoIds) || videoIds.some((id) => typeof id !== "string")) return null;
  const ids = [...new Set(videoIds)]; if (!ids.length) return ids;
  const rows = await sql()`SELECT id FROM youtube_videos WHERE id = ANY(${ids})`;
  return rows.length === ids.length ? ids : null;
}

export async function GET() {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers: noStore });
  await ensureSchema();
  const groups = await groupsWithPasswords();
  const links = await sql()`SELECT group_id, module_id, video_id, sort_order FROM video_groups`;
  const modules = await sql()`SELECT id, group_id, title, sort_order FROM group_modules ORDER BY sort_order ASC`;
  return NextResponse.json({ groups: groups.map((group: any) => ({ ...group, videoIds: links.filter((link: any) => link.group_id === group.id).map((link: any) => link.video_id), modules: modules.filter((module: any) => module.group_id === group.id).map((module: any) => ({ id: module.id, title: module.title, sortOrder: Number(module.sort_order), videoIds: links.filter((link: any) => link.module_id === module.id).sort((a: any, b: any) => Number(a.sort_order) - Number(b.sort_order)).map((link: any) => link.video_id) })) })) }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers: noStore });
  await ensureSchema(); const body = await request.json() as { name?: unknown; password?: unknown; moduleTitle?: unknown; videoIds?: unknown };
  const name = await validName(body.name); const password = await validPassword(body.password); const videoIds = await validVideoIds(body.videoIds ?? []);
  if (!name) return NextResponse.json({ error: "Nama group wajib dan mesti unik (maksimum 80 aksara)." }, { status: 400, headers: noStore });
  if (!password) return NextResponse.json({ error: "Password mesti 6–100 aksara, unik dan berbeza daripada password admin." }, { status: 400, headers: noStore });
  const moduleTitle = String(body.moduleTitle || "").trim();
  if (!moduleTitle || moduleTitle.length > 100) return NextResponse.json({ error: "Tajuk modul pertama wajib diisi (maksimum 100 aksara)." }, { status: 400, headers: noStore });
  if (!videoIds) return NextResponse.json({ error: "Pilihan video tidak sah." }, { status: 400, headers: noStore });
  const id = randomUUID(); const encrypted = await encryptGroupPassword(password);
  await sql()`INSERT INTO access_groups (id, name, password_ciphertext, password_iv) VALUES (${id}, ${name}, ${encrypted.ciphertext}, ${encrypted.iv})`;
  const moduleId = randomUUID(); await sql()`INSERT INTO group_modules (id, group_id, title, sort_order) VALUES (${moduleId}, ${id}, ${moduleTitle}, 0)`;
  for (const [index, videoId] of videoIds.entries()) await sql()`INSERT INTO video_groups (video_id, group_id, module_id, sort_order) VALUES (${videoId}, ${id}, ${moduleId}, ${index})`;
  return NextResponse.json({ ok: true, id }, { status: 201, headers: noStore });
}
