import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { encryptGroupPassword } from "@/lib/group-password";

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
  await db`CREATE TABLE IF NOT EXISTS access_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL, password_ciphertext TEXT NOT NULL, password_iv TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await db`CREATE UNIQUE INDEX IF NOT EXISTS access_groups_name_ci_idx ON access_groups (LOWER(name))`;
  await db`CREATE TABLE IF NOT EXISTS video_groups (video_id TEXT NOT NULL REFERENCES youtube_videos(id) ON DELETE CASCADE, group_id TEXT NOT NULL REFERENCES access_groups(id) ON DELETE CASCADE, PRIMARY KEY (video_id, group_id))`;
  await db`CREATE INDEX IF NOT EXISTS video_groups_group_idx ON video_groups(group_id)`;
  const groups = await db`SELECT id FROM access_groups LIMIT 1`;
  if (!groups[0]) {
    const password = process.env.STUDENT_PASSWORD;
    if (!password) throw new Error("STUDENT_PASSWORD diperlukan untuk migrasi group pertama.");
    const encrypted = await encryptGroupPassword(password);
    const id = randomUUID();
    await db`INSERT INTO access_groups (id, name, password_ciphertext, password_iv) VALUES (${id}, ${"BONUS K-METHOD"}, ${encrypted.ciphertext}, ${encrypted.iv})`;
    await db`INSERT INTO video_groups (video_id, group_id) SELECT id, ${id} FROM youtube_videos ON CONFLICT DO NOTHING`;
  }
  initialized = true;
}
