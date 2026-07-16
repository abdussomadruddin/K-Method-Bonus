"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { youtubeEmbedUrl } from "@/lib/youtube";

type Role = "admin" | "student";
type Video = { id: string; title: string; youtubeId: string; createdAt: string };

function formatPlayerTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
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
  const [playerPlaying, setPlayerPlaying] = useState(true);
  const [playerMuted, setPlayerMuted] = useState(false);
  const [playerFullscreen, setPlayerFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const playerFrameRef = useRef<HTMLElement>(null);
  const currentTimeRef = useRef(0);

  useEffect(() => {
    if (selected) {
      setPlayerPlaying(true); setPlayerMuted(false); setCurrentTime(0); setDuration(0);
      currentTimeRef.current = 0;
    }
  }, [selected]);

  useEffect(() => {
    const updateFullscreen = () => setPlayerFullscreen(document.fullscreenElement === playerFrameRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  useEffect(() => {
    const receivePlayerInfo = (event: MessageEvent) => {
      if (event.source !== playerRef.current?.contentWindow) return;
      let data: { event?: string; info?: { currentTime?: number; duration?: number } };
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data.event !== "infoDelivery" || !data.info) return;
      if (typeof data.info.currentTime === "number") {
        currentTimeRef.current = data.info.currentTime;
        setCurrentTime(data.info.currentTime);
      }
      if (typeof data.info.duration === "number") setDuration(data.info.duration);
    };
    window.addEventListener("message", receivePlayerInfo);
    return () => window.removeEventListener("message", receivePlayerInfo);
  }, []);

  useEffect(() => {
    if (!selected || !playerPlaying || playbackRate <= 2) return;
    const booster = window.setInterval(() => {
      playerCommand("seekTo", [currentTimeRef.current + playbackRate - 2, true]);
    }, 1000);
    return () => window.clearInterval(booster);
  }, [playbackRate, playerPlaying, selected]);

  function playerCommand(command: "playVideo" | "pauseVideo" | "mute" | "unMute" | "setPlaybackRate" | "seekTo", args: Array<number | boolean> = []) {
    playerRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: command, args }), "https://www.youtube-nocookie.com");
  }

  function connectPlayer() {
    playerRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "lms-player" }), "https://www.youtube-nocookie.com");
    playerCommand("setPlaybackRate", [Math.min(playbackRate, 2)]);
  }

  function changePlaybackRate(rate: number) {
    setPlaybackRate(rate);
    playerCommand("setPlaybackRate", [Math.min(rate, 2)]);
  }

  function seekVideo(time: number) {
    currentTimeRef.current = time;
    setCurrentTime(time);
    playerCommand("seekTo", [time, true]);
  }

  function togglePlayback() {
    playerCommand(playerPlaying ? "pauseVideo" : "playVideo");
    setPlayerPlaying((value) => !value);
  }

  function toggleSound() {
    playerCommand(playerMuted ? "unMute" : "mute");
    setPlayerMuted((value) => !value);
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await playerFrameRef.current?.requestFullscreen();
  }
  async function addVideo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setNotice(""); setWorking("add");
    const body = new FormData(e.currentTarget);
    const response = await fetch("/api/videos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: body.get("title"), youtubeUrl: body.get("youtubeUrl") }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setUploadOpen(false); setNotice("Video YouTube berjaya ditambah."); await reload(); }
    else setNotice(data.error || "Video tidak dapat ditambah.");
    setWorking("");
  }

  async function edit(video: Video) {
    const title = window.prompt("Tajuk baharu", video.title)?.trim();
    if (!title || title === video.title) return;
    const youtubeUrl = window.prompt("Pautan YouTube baharu (biarkan kosong untuk kekalkan pautan sedia ada)", "")?.trim();
    const response = await fetch(`/api/videos/${video.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, ...(youtubeUrl ? { youtubeUrl } : {}) }) });
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
      <section className={`dashboard${role === "student" ? " video-library" : ""}`}>
        {role === "admin" && <><div className="welcome-row">
          <div><p className="eyebrow">{role === "admin" ? "PANEL PENGURUSAN" : "PERPUSTAKAAN VIDEO"}</p><h1>{role === "admin" ? "Urus kandungan anda" : "Teruskan pembelajaran anda"}</h1><p className="muted">{role === "admin" ? "Tambah dan kemas kini video pembelajaran di satu tempat." : "Pilih video dan mula belajar mengikut masa anda."}</p></div>
          {role === "admin" && <button className="primary" onClick={() => setUploadOpen(true)}>＋ Tambah video</button>}
        </div>
        <div className="toolbar"><div className="search"><span>⌕</span><input aria-label="Cari video" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari tajuk video..." /></div><span className="count">{allVideos.length} video</span></div></>}
        {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {videos.length === 0 ? <section className="empty"><div>▷</div><h2>{search ? "Tiada video ditemui" : "Belum ada video"}</h2><p>{search ? "Cuba kata carian yang lain." : role === "admin" ? "Muat naik video pertama untuk mula membina perpustakaan." : "Kandungan pembelajaran akan muncul di sini."}</p></section> :
          <section className="video-grid">{videos.map((video, index) => <article className="video-card" key={video.id}>
            <button className="thumbnail" onClick={() => setSelected(video)} aria-label={`Mainkan ${video.title}`}><img src={`https://i.ytimg.com/vi/${video.youtubeId}/maxresdefault.jpg`} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`; }} alt="" loading="lazy" draggable={false} referrerPolicy="no-referrer" /><span className="number">{String(index + 1).padStart(2, "0")}</span><span className="play">▶</span><span className="duration">VIDEO</span></button>
            <div className="card-body"><h2>{video.title}</h2>{role === "admin" && <div className="card-actions"><button onClick={() => edit(video)}>Ubah tajuk</button><button className="danger" disabled={working === video.id} onClick={() => remove(video)}>Padam</button></div>}</div>
          </article>)}</section>}
      </section>
      {selected && <div className="modal-backdrop player-backdrop" onMouseDown={() => setSelected(null)} onContextMenu={(e) => e.preventDefault()}><section className="player-modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={selected.title}><button className="modal-close" onClick={() => setSelected(null)} aria-label="Tutup">×</button><section ref={playerFrameRef} className={`player-frame${role === "student" ? " student-player" : ""}`}><iframe ref={playerRef} className="youtube-player" src={youtubeEmbedUrl(selected.youtubeId, window.location.origin, role === "student")} title={selected.title} allow="autoplay; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation" allowFullScreen={false} referrerPolicy="strict-origin-when-cross-origin" onLoad={connectPlayer} />{role === "student" && <><button type="button" className="player-surface" onClick={togglePlayback} onContextMenu={(e) => e.preventDefault()} aria-label={playerPlaying ? "Jeda video" : "Mainkan video"}><span>{playerPlaying ? "❚❚" : "▶"}</span></button><div className="lms-player-controls"><div className="lms-seek"><span>{formatPlayerTime(currentTime)}</span><input type="range" min="0" max={duration || 0} step="1" value={Math.min(currentTime, duration || 0)} onChange={(event) => seekVideo(Number(event.target.value))} aria-label="Pilih masa video" /><span>{formatPlayerTime(duration)}</span></div><button type="button" onClick={togglePlayback}>{playerPlaying ? "❚❚ Jeda" : "▶ Main"}</button><button type="button" onClick={toggleSound}>{playerMuted ? "🔇 Hidupkan suara" : "🔊 Senyapkan"}</button><label className="lms-speed"><span>Kelajuan</span><select value={playbackRate} onChange={(event) => changePlaybackRate(Number(event.target.value))}>{[1, 1.25, 1.5, 2, 2.5, 3].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label><button type="button" onClick={toggleFullscreen}>{playerFullscreen ? "⊙ Keluar skrin penuh" : "⛶ Skrin penuh"}</button></div></>}</section><div><p className="eyebrow">VIDEO PEMBELAJARAN</p><h2>{selected.title}</h2></div></section></div>}
      {uploadOpen && <div className="modal-backdrop" onMouseDown={() => setUploadOpen(false)}><form className="upload-modal" onSubmit={addVideo} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={() => setUploadOpen(false)}>×</button><p className="eyebrow">KANDUNGAN BAHARU</p><h2>Tambah video YouTube</h2><p className="muted">Gunakan pautan video YouTube yang ditetapkan sebagai Unlisted.</p><label htmlFor="title">Tajuk video</label><input id="title" name="title" maxLength={150} required placeholder="Contoh: Pengenalan K-Method" /><label htmlFor="youtubeUrl">Pautan YouTube</label><input id="youtubeUrl" name="youtubeUrl" type="url" required placeholder="https://youtu.be/..." /><button className="primary full" disabled={working === "add"}>{working === "add" ? "Sedang menambah..." : "Tambah video"}</button></form></div>}
    </main>
  );
}
