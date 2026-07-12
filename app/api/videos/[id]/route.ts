import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { deleteDriveFile, saveDriveVideo } from "@/lib/google-drive";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const title = String((await request.json()).title || "").trim();
  if (!title || title.length > 150) return NextResponse.json({ error: "Tajuk mesti antara 1 hingga 150 aksara." }, { status: 400 });
  const { id } = await params;
  await saveDriveVideo(id, title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await readSession() !== "admin") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const { id } = await params;
  await deleteDriveFile(id);
  return NextResponse.json({ ok: true });
}
