import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { ensureSchema, sql } from "@/lib/runtime";
import { streamDriveFile } from "@/lib/google-drive";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  await ensureSchema(); const { id } = await params;
  const [row] = await sql()`SELECT object_url as "objectUrl", content_type as "contentType", size FROM videos WHERE id=${id}` as {objectUrl:string;contentType:string;size:number}[];
  if (!row) return NextResponse.json({ error: "Video tidak ditemui." }, { status: 404 });
  const object = await streamDriveFile(row.objectUrl, request.headers.get("range"));
  if (!object.ok || !object.body) return NextResponse.json({ error: "Fail video tidak ditemui." }, { status: 404 });
  const headers = new Headers({ "Content-Type": row.contentType, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "Content-Disposition": "inline" });
  for (const name of ["content-length", "content-range"]) { const value = object.headers.get(name); if (value) headers.set(name, value); }
  return new Response(object.body, { status: object.status, headers });
}
