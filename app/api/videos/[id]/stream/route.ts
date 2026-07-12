import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { driveFile, streamDriveFile } from "@/lib/google-drive";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const { id } = await params;
  const file = await driveFile(id);
  const object = await streamDriveFile(id, request.headers.get("range"));
  if (!object.ok || !object.body) return NextResponse.json({ error: "Fail video tidak ditemui." }, { status: 404 });
  const headers = new Headers({ "Content-Type": file.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store", "Content-Disposition": "inline" });
  for (const name of ["content-length", "content-range"]) { const value = object.headers.get(name); if (value) headers.set(name, value); }
  return new Response(object.body, { status: object.status, headers });
}
