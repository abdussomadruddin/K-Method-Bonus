const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken: { value: string; expiresAt: number } | null = null;

function config() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !folderId) throw new Error("Google Drive OAuth belum dikonfigurasi.");
  return { clientId, clientSecret, refreshToken, folderId };
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const { clientId, clientSecret, refreshToken } = config();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
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
