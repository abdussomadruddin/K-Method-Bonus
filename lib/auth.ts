import { cookies } from "next/headers";

export type Role = "admin" | "student";
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

export async function createSession(role: Role) {
  const payload = b64(encoder.encode(JSON.stringify({ role, exp: Math.floor(Date.now() / 1000) + MAX_AGE })));
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(): Promise<Role | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || (await sign(payload)) !== signature) return null;
  try {
    const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized), (c) => c.charCodeAt(0))));
    if ((data.role !== "admin" && data.role !== "student") || data.exp < Date.now() / 1000) return null;
    return data.role;
  } catch { return null; }
}

export async function setSessionCookie(role: Role) {
  (await cookies()).set(COOKIE, await createSession(role), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function clearSessionCookie() { (await cookies()).delete(COOKIE); }
export function expectedPassword(role: Role) { return role === "admin" ? (process.env.ADMIN_PASSWORD || "") : (process.env.STUDENT_PASSWORD || ""); }
export function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let result = 0; for (let i=0;i<a.length;i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }
