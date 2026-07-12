import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema(); const { id } = await params;
  const [row] = await sql()`SELECT object_url as "objectUrl", content_type as "contentType", size FROM videos WHERE id=${id}` as {objectUrl:string;contentType:string;size:number}[];
  if (!row) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  const object = await get(row.objectUrl, { access: "private" });
  if (!object?.stream) return NextResponse.json({ error: "Fail video tidak ditemui." }, { status: 404 });
  return new Response(object.stream, { headers: { "Content-Type": row.contentType, "Content-Length": String(row.size), "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "Content-Disposition": "inline" } });
}
