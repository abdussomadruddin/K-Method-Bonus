import { neon } from "@neondatabase/serverless";

let initialized = false;
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi.");
  return neon(process.env.DATABASE_URL);
}
export async function ensureSchema() {
  if (initialized) return;
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS videos (id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size BIGINT NOT NULL, object_url TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL)`;
  await db`CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos(created_at DESC)`;
  initialized = true;
}
