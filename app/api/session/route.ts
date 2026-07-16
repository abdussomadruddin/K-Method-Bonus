import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, expectedPassword, readSession, safeEqual, setSessionCookie, type Session } from "@/lib/auth";
import { decryptGroupPassword } from "@/lib/group-password";
import { ensureSchema, sql } from "@/lib/runtime";

const attempts = new Map<string, { count: number; reset: number }>();

export async function GET() {
  const session = await readSession();
  return session ? NextResponse.json(session) : NextResponse.json({ error: "Sesi tidak sah." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const now = Date.now(); const current = attempts.get(ip);
  if (current && current.reset > now && current.count >= 8) return NextResponse.json({ error: "Terlalu banyak percubaan. Cuba semula dalam 15 minit." }, { status: 429 });
  try {
    const { password } = await request.json() as { password?: string };
    if (typeof password !== "string" || !password) return NextResponse.json({ error: "Kata laluan tidak tepat untuk akses ini." }, { status: 401 });
    await ensureSchema();
    let session: Session | null = safeEqual(password, expectedPassword("admin")) ? { role: "admin" } : null;
    if (!session) {
      const groups = await sql()`SELECT id, name, password_ciphertext, password_iv, session_version FROM access_groups`;
      for (const group of groups) {
        if (safeEqual(password, await decryptGroupPassword(group.password_ciphertext, group.password_iv))) {
          session = { role: "student" as const, groupId: group.id, groupName: group.name, version: Number(group.session_version) };
          break;
        }
      }
    }
    if (!session) {
      attempts.set(ip, { count: current && current.reset > now ? current.count + 1 : 1, reset: now + 15 * 60_000 });
      return NextResponse.json({ error: "Kata laluan tidak tepat untuk akses ini." }, { status: 401 });
    }
    attempts.delete(ip); await setSessionCookie(session);
    return NextResponse.json(session);
  } catch { return NextResponse.json({ error: "Permintaan tidak sah." }, { status: 400 }); }
}

export async function DELETE() { await clearSessionCookie(); return NextResponse.json({ ok: true }); }
