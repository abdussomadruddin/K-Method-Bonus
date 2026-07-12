import { createSign } from "node:crypto";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64Url(value: string) { return Buffer.from(value).toString("base64url"); }

function config() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!email || !privateKey || !folderId) throw new Error("Google Drive belum dikonfigurasi.");
  return { email, privateKey, folderId };
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { email, privateKey } = config();
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iss: email, scope: DRIVE_SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))}`;
  const signer = createSign("RSA-SHA256"); signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(privateKey, "base64url")}`;
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
  if (!response.ok) throw new Error("Tidak dapat mendapatkan akses Google Drive.");
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export async function startDriveUpload(name: string, contentType: string, size: number) {
  const token = await accessToken(); const { folderId } = config();
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": contentType, "X-Upload-Content-Length": String(size) }, body: JSON.stringify({ name, parents: [folderId] }) });
  const uploadUrl = response.headers.get("location");
  if (!response.ok || !uploadUrl) throw new Error("Tidak dapat memulakan muat naik Google Drive.");
  return uploadUrl;
}

export async function driveFile(id: string) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Fail video tidak ditemui di Google Drive.");
  return response.json() as Promise<{ id: string; name: string; mimeType: string; size: string }>;
}

export async function streamDriveFile(id: string, range: string | null) {
  const token = await accessToken();
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) } });
}

export async function deleteDriveFile(id: string) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok && response.status !== 404) throw new Error("Tidak dapat memadam fail daripada Google Drive.");
}
