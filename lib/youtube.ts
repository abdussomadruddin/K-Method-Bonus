const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(value: string) {
  const source = value.trim();
  if (VIDEO_ID.test(source)) return source;

  try {
    const url = new URL(source);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0] || "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      id = url.searchParams.get("v") || "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (!id && ["embed", "shorts", "live"].includes(parts[0] || "")) id = parts[1] || "";
    }
    return VIDEO_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoId: string, origin?: string, restricted = false) {
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: restricted ? "0" : "1",
    disablekb: "1",
    enablejsapi: "1",
    fs: "0",
    iv_load_policy: "3",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}
