import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { driveThumbnail } from "@/lib/google-drive";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await readSession()) return NextResponse.json({ error: "Log masuk diperlukan." }, { status: 401 });
  const { id } = await params;
  const thumbnail = await driveThumbnail(id);
  if (!thumbnail?.body) return new NextResponse(null, { status: 404 });
  return new Response(thumbnail.body, {
    headers: {
      "Content-Type": thumbnail.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
