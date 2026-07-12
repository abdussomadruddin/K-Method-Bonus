import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const title = String((await request.json()).title || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  await ensureSchema(); const { id } = await params;
  const rows = await sql()`UPDATE videos SET title=${title} WHERE id=${id} RETURNING id`;
  return rows.length ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  await ensureSchema(); const { id } = await params;
  const [row] = await sql()`SELECT object_url as "objectUrl" FROM videos WHERE id=${id}` as {objectUrl:string}[];
  if (!row) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  await del(row.objectUrl);
  await sql()`DELETE FROM videos WHERE id=${id}`;
  return NextResponse.json({ ok: true });
}
