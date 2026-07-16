import { cookies } from "next/headers";
import { ensureSchema, sql } from "@/lib/runtime";

export type Role = "admin" | "student";
export type Session = { role: "admin" } | { role: "student"; groupId: string; groupName: string; version: number };
const COOKIE = "bkm_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
async function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum dikonfigurasi.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSession(session: Session) {
  const payload = b64(encoder.encode(JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload)) !== signature) return null;
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0))));
    if (data.exp < Date.now() / 1000) return null;
    if (data.role === "admin") return { role: "admin" };
    if (data.role !== "student" || typeof data.groupId !== "string" || typeof data.version !== "number") return null;
    await ensureSchema();
    const rows = await sql()`SELECT name, session_version FROM access_groups WHERE id = ${data.groupId}`;
    if (!rows[0] || Number(rows[0].session_version) !== data.version) return null;
    return { role: "student", groupId: data.groupId, groupName: rows[0].name, version: data.version };
  } catch { return null; }
}

export async function setSessionCookie(session: Session) {
  (await cookies()).set(COOKIE, await createSession(session), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}
export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }
export function expectedPassword(role: "admin") { return role === "admin" ? (process.env.ADMIN_PASSWORD || "") : ""; }
export function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let result = 0; for (let i=0;i<a.length;i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
