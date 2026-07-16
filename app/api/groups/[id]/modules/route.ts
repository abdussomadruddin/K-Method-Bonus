import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";

const headers = { "Cache-Control": "no-store" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers });
  await ensureSchema(); const { id: groupId } = await params; const { title: rawTitle } = await request.json() as { title?: string };
  const title = String(rawTitle || "").trim(); if (!title || title.length > 100) return NextResponse.json({ error: "Tajuk modul mesti 1 hingga 100 aksara." }, { status: 400, headers });
  const group = await sql()`SELECT id FROM access_groups WHERE id = ${groupId}`; if (!group[0]) return NextResponse.json({ error: "Group tidak ditemui." }, { status: 404, headers });
  const next = await sql()`SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM group_modules WHERE group_id = ${groupId}`;
  const id = randomUUID(); await sql()`INSERT INTO group_modules (id, group_id, title, sort_order) VALUES (${id}, ${groupId}, ${title}, ${Number(next[0].value)})`;
  return NextResponse.json({ id }, { status: 201, headers });
}
