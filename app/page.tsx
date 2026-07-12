"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

type Role = "admin" | "student";
type Video = { id: string; title: string; filename: string; contentType: string; size: number; createdAt: string };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ms-MY", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function VideoThumbnail({ video, index, onOpen }: { video: Video; index: number; onOpen: (video: Video) => void }) {
  const [useFrameFallback, setUseFrameFallback] = useState(false);
  const [frame, setFrame] = useState<string | null>(null);
  const sourceRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!useFrameFallback) return;
    const source = sourceRef.current;
    if (!source) return;
    let active = true;
    const capture = () => {
      if (!active || !source.videoWidth || !source.videoHeight) return;
      const canvas = document.createElement("canvas");
      canvas.width = source.videoWidth;
      canvas.height = source.videoHeight;
      canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
      try { setFrame(canvas.toDataURL("image/jpeg", 0.8)); } catch { /* Keep the fallback artwork. */ }
    };
    const seekToFirstFrame = () => {
      if (Number.isFinite(source.duration) && source.duration > 0.01) source.currentTime = 0.01;
      else capture();
    };
    source.addEventListener("loadedmetadata", seekToFirstFrame);
    source.addEventListener("seeked", capture);
    if (source.readyState >= 1) seekToFirstFrame();
    return () => {
      active = false;
      source.removeEventListener("loadedmetadata", seekToFirstFrame);
      source.removeEventListener("seeked", capture);
    };
  }, [useFrameFallback, video.id]);

  return <button className="thumbnail" onClick={() => onOpen(video)} aria-label={`Mainkan ${video.title}`}>
    {!useFrameFallback && <img src={`/api/videos/${video.id}/thumbnail`} alt="" onError={() => setUseFrameFallback(true)} />}
    {frame && <img src={frame} alt="" />}
    {useFrameFallback && <video ref={sourceRef} className="thumbnail-source" src={`/api/videos/${video.id}/stream`} muted playsInline preload="metadata" aria-hidden="true" tabIndex={-1} />}
    <span className="number">{String(index + 1).padStart(2, "0")}</span><span className="play">▶</span><span className="duration">VIDEO</span>
  </button>;
}

export default function Home() {
  const [session, setSession] = useState<{ role: Role } | null>(null);
  const [checking, setChecking] = useState(true);
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Video | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadVideos = useCallback(async () => {
    const response = await fetch("/api/videos", { cache: "no-store" });
    if (response.status === 401) { setSession(null); return; }
    if (response.ok) setVideos((await response.json()).videos);
  }, []);

  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(async (r) => { if (r.ok) setSession(await r.json()); })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => { if (session) void loadVideos(); }, [session, loadVideos]);

  const filtered = useMemo(() => videos.filter((v) => v.title.toLowerCase().includes(search.toLowerCase())), [videos, search]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: form.get("password") }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setSession({ role: data.role }); setMessage(""); }
    else setMessage(data.error || "Log masuk gagal. Sila cuba lagi.");
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setSession(null); setVideos([]); setSelected(null); setMessage("");
  }

  if (checking) return <main className="center-screen"><div className="loader" aria-label="Memuatkan" /></main>;

  if (!session) return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="brand-mark">K</div>
        <div>
          <p className="eyebrow light">BONUS K-METHOD</p>
          <h1>Belajar dengan fokus.<br />Kuasa dengan ilmu.</h1>
          <p className="brand-copy">Ruang pembelajaran video yang tersusun untuk membantu anda bergerak selangkah demi selangkah.</p>
        </div>
        <p className="brand-foot">Kandungan eksklusif • Akses selamat</p>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={login}>
          <p className="eyebrow">SELAMAT DATANG</p>
          <h2>Log masuk ke portal</h2>
          <p className="muted">Masukkan kata laluan anda untuk meneruskan.</p>
          <label htmlFor="password">Kata laluan</label>
          <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Masukkan kata laluan" required />
          {message && <p className="error" role="alert">{message}</p>}
          <button className="primary full" disabled={busy}>{busy ? "Menyemak..." : "Log masuk"} <span>→</span></button>
          <p className="privacy">🔒 Sesi anda dilindungi dan sah selama 7 hari.</p>
        </form>
      </section>
    </main>
  );

  return <Dashboard role={session.role} videos={filtered} allVideos={videos} search={search} setSearch={setSearch} selected={selected} setSelected={setSelected} reload={loadVideos} logout={logout} />;
}

function Dashboard({ role, videos, allVideos, search, setSearch, selected, setSelected, reload, logout }: { role: Role; videos: Video[]; allVideos: Video[]; search: string; setSearch: (v: string) => void; selected: Video | null; setSelected: (v: Video | null) => void; reload: () => Promise<void>; logout: () => Promise<void> }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  function openVideo(video: Video) {
    if (role !== "student") { setSelected(video); return; }
    flushSync(() => setSelected(video));
    const player = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!player) return;
    if (typeof player.webkitEnterFullscreen === "function") player.webkitEnterFullscreen();
    else void player.requestFullscreen?.().catch(() => document.documentElement.requestFullscreen?.().catch(() => {}));
    void player.play().catch(() => {});
  }

  function closeVideo() {
    setSelected(null);
    if (document.fullscreenElement) void document.exitFullscreen?.();
  }

  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setNotice(""); setWorking("upload");
    const body = new FormData(e.currentTarget);
    const file = body.get("video");
    if (!(file instanceof File)) { setWorking(""); return; }
    const session = await fetch("/api/videos/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) });
    const sessionData = await session.json().catch(() => ({}));
    if (!session.ok) { setNotice(sessionData.error || "Muat naik tidak dapat dimulakan."); setWorking(""); return; }
    const chunkSize = 8 * 1024 * 1024;
    let offset = 0; let driveFileId = "";
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const uploadResponse = await fetch(sessionData.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, "Content-Range": `bytes ${offset}-${end - 1}/${file.size}` }, body: file.slice(offset, end) });
      if (uploadResponse.status !== 308 && !uploadResponse.ok) { setNotice("Muat naik ke Google Drive tidak berjaya."); setWorking(""); return; }
      if (uploadResponse.ok) driveFileId = (await uploadResponse.json()).id;
      offset = end;
    }
    const response = await fetch("/api/videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: body.get("title"), driveFileId }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setUploadOpen(false); setNotice("Video berjaya dimuat naik."); await reload(); }
    else setNotice(data.error || "Muat naik tidak berjaya.");
    setWorking("");
  }

  async function edit(video: Video) {
    const title = window.prompt("Tajuk baharu", video.title)?.trim();
    if (!title || title === video.title) return;
    const response = await fetch(`/api/videos/${video.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title }) });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Tajuk berjaya dikemas kini." : data.error || "Tajuk tidak dapat dikemas kini.");
    if (response.ok) await reload();
  }

  async function remove(video: Video) {
    if (!window.confirm(`Padam “${video.title}”? Tindakan ini tidak boleh dibatalkan.`)) return;
    setWorking(video.id);
    const response = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Video telah dipadam." : data.error || "Video tidak dapat dipadam.");
    if (response.ok) { if (selected?.id === video.id) setSelected(null); await reload(); }
    setWorking("");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="logo-row"><div className="brand-mark small">K</div><div><strong>Bonus K-Method</strong><span>Portal Pembelajaran</span></div></div>
        <div className="top-actions"><span className="role-badge">{role === "admin" ? "Admin" : "Student"}</span><button className="ghost" onClick={logout}>Log keluar ↗</button></div>
      </header>
      <section className="dashboard">
        {role === "admin" && <div className="welcome-row"><div><p className="eyebrow">PANEL PENGURUSAN</p><h1>Urus kandungan anda</h1><p className="muted">Tambah dan kemas kini video pembelajaran di satu tempat.</p></div><button className="primary" onClick={() => setUploadOpen(true)}>＋ Muat naik video</button></div>}
        <div className="toolbar"><div className="search"><span>⌕</span><input aria-label="Cari video" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tajuk video..." /></div><span className="count">{allVideos.length} video</span></div>
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {videos.length === 0 ? <section className="empty"><div>▷</div><h2>{search ? "Tiada video ditemui" : "Belum ada video"}</h2><p>{search ? "Cuba kata carian yang lain." : role === "admin" ? "Muat naik video pertama untuk mula membina perpustakaan." : "Kandungan pembelajaran akan muncul di sini."}</p></section> :
          <section className="video-grid">{videos.map((video, index) => <article className="video-card" key={video.id}>
            <VideoThumbnail video={video} index={index} onOpen={openVideo} />
            <div className="card-body"><h2>{video.title}</h2><p>{formatDate(video.createdAt)} · {formatSize(video.size)}</p>{role === "admin" && <div className="card-actions"><button onClick={() => edit(video)}>Ubah tajuk</button><button className="danger" disabled={working === video.id} onClick={() => remove(video)}>Padam</button></div>}</div>
          </article>)}</section>}
      </section>
      {role === "admin" && <footer><span>© 2026 Bonus K-Method</span><span>Belajar • Praktik • Kuasai</span></footer>}
      {selected && <div className="modal-backdrop" onMouseDown={closeVideo}><section className="player-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={selected.title}><button className="modal-close" onClick={closeVideo} aria-label="Tutup">×</button><video ref={videoRef} src={`/api/videos/${selected.id}/stream`} controls autoPlay playsInline controlsList={role === "student" ? "nodownload" : undefined} onCanPlay={() => { if (role === "student") void videoRef.current?.play().catch(() => {}); }} /><div><p className="eyebrow">VIDEO PEMBELAJARAN</p><h2>{selected.title}</h2></div></section></div>}
      {uploadOpen && <div className="modal-backdrop" onMouseDown={() => setUploadOpen(false)}><form className="upload-modal" onSubmit={upload} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={() => setUploadOpen(false)}>×</button><p className="eyebrow">KANDUNGAN BAHARU</p><h2>Muat naik video</h2><label htmlFor="title">Tajuk video</label><input id="title" name="title" maxLength={150} required placeholder="Contoh: Pengenalan K-Method" /><label htmlFor="video">Fail video</label><div className="file-drop" onClick={() => fileRef.current?.click()}>↑<strong>Pilih fail video</strong><span>MP4, WebM atau MOV · Fail besar disokong</span></div><input ref={fileRef} className="sr-only" id="video" name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required /><button className="primary full" disabled={working === "upload"}>{working === "upload" ? "Sedang memuat naik..." : "Muat naik video"}</button></form></div>}
    </main>
  );
}
