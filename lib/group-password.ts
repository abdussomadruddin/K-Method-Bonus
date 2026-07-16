const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); }
function fromB64(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

async function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET belum dikonfigurasi.");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`group-password:${secret}`));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptGroupPassword(password: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), encoder.encode(password));
  return { ciphertext: b64(new Uint8Array(encrypted)), iv: b64(iv) };
}

export async function decryptGroupPassword(ciphertext: string, iv: string) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await key(), fromB64(ciphertext));
  return decoder.decode(decrypted);
}
