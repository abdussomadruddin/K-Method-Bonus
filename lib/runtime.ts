import { neon } from "@neondatabase/serverless";

let initialized = false;
export function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum dikonfigurasi.");
  return neon(process.env.DATABASE_URL);
}
export async function ensureSchema() {
  if (initialized) return;
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS youtube_videos (id TEXT PRIMARY KEY, title TEXT NOT NULL, youtube_id TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`CREATE INDEX IF NOT EXISTS youtube_videos_created_at_idx ON youtube_videos(created_at DESC)`;
  initialized = true;
}
