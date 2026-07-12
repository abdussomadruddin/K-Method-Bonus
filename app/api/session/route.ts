import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, expectedPassword, readSession, safeEqual, setSessionCookie, type Role } from "@/lib/auth";

const attempts = new Map<string, { count: number; reset: number }>();

export async function GET() {
  const role = await readSession();
  return role ? NextResponse.json({ role }) : NextResponse.json({ error: "Sesi tidak sah." }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const now = Date.now(); const current = attempts.get(ip);
  if (current && current.reset > now && current.count >= 8) return NextResponse.json({ error: "Terlalu banyak percubaan. Cuba semula dalam 15 minit." }, { status: 429 });
  try {
    const { password } = await request.json() as { password?: string };
    const role: Role | null = typeof password !== "string" || !password
      ? null
      : safeEqual(password, expectedPassword("admin"))
        ? "admin"
        : safeEqual(password, expectedPassword("student"))
          ? "student"
          : null;
    if (!role) {
      attempts.set(ip, { count: current && current.reset > now ? current.count + 1 : 1, reset: now + 15 * 60_000 });
      return NextResponse.json({ error: "Kata laluan tidak tepat untuk akses ini." }, { status: 401 });
    }
    attempts.delete(ip); await setSessionCookie(role);
    return NextResponse.json({ role });
  } catch { return NextResponse.json({ error: "Permintaan tidak sah." }, { status: 400 }); }
}

export async function DELETE() { await clearSessionCookie(); return NextResponse.json({ ok: true }); }
