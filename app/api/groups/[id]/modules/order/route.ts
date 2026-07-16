import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
const headers = { "Cache-Control": "no-store" };
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if ((await readSession())?.role !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403, headers });
  await ensureSchema(); const { id: groupId } = await params; const { moduleIds } = await request.json() as { moduleIds?: unknown };
  if (!Array.isArray(moduleIds) || moduleIds.some((id) => typeof id !== "string")) return NextResponse.json({ error: "Susunan modul tidak sah." }, { status: 400, headers });
  const current = await sql()`SELECT id FROM group_modules WHERE group_id = ${groupId}`; if (current.length !== moduleIds.length || !moduleIds.every((id) => current.some((module: any) => module.id === id))) return NextResponse.json({ error: "Susunan modul tidak sah." }, { status: 400, headers });
  for (const [index, id] of moduleIds.entries()) await sql()`UPDATE group_modules SET sort_order = ${index} WHERE id = ${id}`;
  return NextResponse.json({ ok: true }, { headers });
}
