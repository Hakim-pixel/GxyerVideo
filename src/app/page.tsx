"use client";

import React, { useState, useEffect } from "react";
import {
  Play,
  Clipboard,
  X,
  Loader2,
  Download,
  Copy,
  Check,
  AlertCircle,
  Folder,
  Layers,
} from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import SandboxedPlayer from "@/components/SandboxedPlayer";
import { ExtractedVideo, FolderItem } from "@/lib/extractor";

interface HistoryItem {
  id: string;
  url: string;
  title: string;
}

export default function Home() {
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<ExtractedVideo | null>(null);
  const [folderData, setFolderData] = useState<ExtractedVideo | null>(null);
  const [currentPlayingUrl, setCurrentPlayingUrl] = useState<string>("");
  const [playerMode, setPlayerMode] = useState<"direct" | "sandbox">("direct");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("gxyervideo_history");
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveToHistory = (item: { url: string; title: string }) => {
    try {
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        url: item.url,
        title: item.title,
      };
      const updated = [newItem, ...history.filter((h) => h.url !== item.url)].slice(0, 5);
      setHistory(updated);
      localStorage.setItem("gxyervideo_history", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem("gxyervideo_history");
    } catch {
      // Ignore
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text);
      }
    } catch {
      // Ignore
    }
  };

  const handleSubmit = async (e?: React.FormEvent, directUrl?: string) => {
    if (e) e.preventDefault();
    const target = directUrl || inputUrl;
    if (!target.trim()) {
      setError("Masukkan link video terlebih dahulu!");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.trim() }),
      });

      const data: ExtractedVideo = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses link ini.");
      }

      // Check if result is a Folder / Playlist
      if (data.isFolder) {
        setFolderData(data);
        // If no video is currently playing, auto-play the first video in the folder!
        if (data.folderItems && data.folderItems.length > 0 && !videoData) {
          const first = data.folderItems[0];
          setCurrentPlayingUrl(first.url);
          handleSubmit(undefined, first.url);
          return;
        }
      } else {
        setVideoData(data);
        setCurrentPlayingUrl(target.trim());
        saveToHistory({
          url: target.trim(),
          title: data.title || target.trim(),
        });

        if (data.type === "iframe" && !data.videoUrl) {
          setPlayerMode("sandbox");
        } else {
          setPlayerMode("direct");
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memproses link.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayFromFolder = (item: FolderItem) => {
    setCurrentPlayingUrl(item.url);
    handleSubmit(undefined, item.url);
  };

  const handleCopyLink = () => {
    const url = videoData?.videoUrl || videoData?.iframeUrl || currentPlayingUrl || inputUrl;
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="min-h-screen w-full bg-[#0a0a0c] text-zinc-100 relative flex flex-col font-sans select-none pb-8"
      style={{
        backgroundImage:
          "linear-gradient(to right, #17171d 1px, transparent 1px), linear-gradient(to bottom, #17171d 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {/* Header Pill Style GxyerBooth */}
      <header className="max-w-3xl mx-auto w-full px-3.5 pt-4 sm:pt-6 z-30">
        <div className="bg-zinc-900 rounded-full border-2 border-zinc-700 shadow-[0_5px_0px_#18181b] px-3.5 py-2 sm:px-5 sm:py-2.5 flex items-center justify-between">
          <div
            onClick={() => {
              setVideoData(null);
              setFolderData(null);
              setInputUrl("");
              setCurrentPlayingUrl("");
            }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-white text-xs font-black shadow-[0_2px_0px_#18181b]">
              GV
            </div>
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              GXYERVIDEO
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-zinc-800 border-2 border-zinc-700 text-zinc-300 shadow-[0_2px_0px_#18181b] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Anti Iklan</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto w-full px-3.5 py-4 sm:py-6 flex flex-col gap-4 relative flex-1">
        {/* VIDEO PLAYER (Front & Center) */}
        {videoData && (
          <div className="bg-zinc-900 rounded-[1.75rem] border-2 border-zinc-700 shadow-[0_6px_0px_#18181b] overflow-hidden flex flex-col">
            <div className="w-full aspect-video bg-black border-b-2 border-zinc-800">
              {playerMode === "direct" && videoData.videoUrl ? (
                <VideoPlayer
                  src={videoData.videoUrl}
                  type={videoData.type}
                  title={videoData.title}
                  poster={videoData.thumbnail}
                  formats={videoData.formats}
                  onFallbackToSandbox={() => setPlayerMode("sandbox")}
                />
              ) : (
                <SandboxedPlayer
                  url={videoData.iframeUrl || videoData.videoUrl || currentPlayingUrl}
                  title={videoData.title}
                  originalUrl={currentPlayingUrl}
                />
              )}
            </div>

            {/* Video Details & Buttons */}
            <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-zinc-900">
              <div className="overflow-hidden">
                <h2 className="text-xs sm:text-sm font-black text-white truncate">
                  {videoData.title || "Video"}
                </h2>
                <p className="text-[10px] sm:text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                  {currentPlayingUrl}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="bg-zinc-800 border-2 border-zinc-700 text-zinc-200 font-bold px-3 py-1.5 rounded-xl shadow-[0_2px_0px_#18181b] hover:bg-zinc-700 active:translate-y-0.5 active:shadow-none transition text-xs flex items-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>

                {videoData.videoUrl && (
                  <a
                    href={videoData.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="bg-white border-2 border-zinc-900 text-black font-black px-3.5 py-1.5 rounded-xl shadow-[0_2px_0px_#18181b] hover:bg-zinc-200 active:translate-y-0.5 active:shadow-none transition text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FOLDER PLAYLIST VIEW (If URL is a folder) */}
        {folderData && folderData.folderItems && folderData.folderItems.length > 0 && (
          <div className="bg-zinc-900 rounded-[1.5rem] border-2 border-zinc-700 shadow-[0_5px_0px_#18181b] p-3.5 sm:p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span className="text-xs sm:text-sm font-black text-white truncate max-w-[200px] sm:max-w-md">
                  {folderData.folderTitle || "Folder Playlist"}
                </span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-300">
                {folderData.folderItems.length} Video
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
              {folderData.folderItems.map((item) => {
                const isPlayingThis = currentPlayingUrl.includes(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handlePlayFromFolder(item)}
                    className={`group rounded-xl border-2 p-2 flex flex-col gap-1.5 cursor-pointer transition-all ${
                      isPlayingThis
                        ? "bg-zinc-800 border-white shadow-[0_3px_0px_#000]"
                        : "bg-zinc-950/70 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/60"
                    }`}
                  >
                    <div className="aspect-video w-full rounded-lg bg-black overflow-hidden relative">
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Play className="w-6 h-6" />
                        </div>
                      )}
                      {isPlayingThis && (
                        <div className="absolute top-1 left-1 bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded">
                          DIPUTAR
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-zinc-200 line-clamp-2 leading-tight">
                      {item.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INPUT BAR */}
        <div className="bg-zinc-900 rounded-[1.5rem] border-2 border-zinc-700 shadow-[0_5px_0px_#18181b] p-3 sm:p-4 flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-zinc-300 uppercase tracking-wide">
              {videoData ? "Putar Link Lain / Folder Lain" : "Paste Link Video atau Folder"}
            </span>
            <span className="text-[10px] font-bold text-zinc-500">
              Bebas Popup & Redirect
            </span>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 w-full">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Paste link video atau folder (Filecoster /d/ atau /f/)..."
                disabled={loading}
                className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-white outline-none focus:border-zinc-400 focus:bg-zinc-950 transition placeholder-zinc-500 pr-16"
              />

              <div className="absolute right-1.5 flex items-center gap-1">
                {inputUrl ? (
                  <button
                    type="button"
                    onClick={() => setInputUrl("")}
                    className="p-1 text-zinc-500 hover:text-white transition"
                    title="Hapus"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-2 py-0.5 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-md transition flex items-center gap-1 font-bold"
                    title="Paste link"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Paste</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !inputUrl.trim()}
              className="bg-white border-2 border-zinc-900 text-black font-black px-4 sm:px-5 py-2 rounded-xl shadow-[0_3px_0px_#18181b] hover:bg-zinc-200 active:translate-y-0.5 active:shadow-none transition-all text-xs sm:text-sm shrink-0 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memproses</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                  <span>Putar</span>
                </>
              )}
            </button>
          </form>

          {/* Error notice */}
          {error && (
            <div className="p-2 bg-rose-500/10 border-2 border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300 font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Quick History Pills */}
        {history.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none px-1">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0">
              Riwayat:
            </span>
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setInputUrl(item.url);
                  handleSubmit(undefined, item.url);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border-2 border-zinc-700 rounded-full px-3 py-1 text-[11px] font-bold text-zinc-300 shrink-0 shadow-[0_2px_0px_#18181b] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 max-w-[150px] sm:max-w-[180px]"
              >
                <Play className="w-2.5 h-2.5 fill-current shrink-0 text-white" />
                <span className="truncate">{item.title}</span>
              </button>
            ))}
            <button
              onClick={handleClearHistory}
              className="text-[10px] font-bold text-zinc-500 hover:text-rose-400 px-1 py-0.5 shrink-0 transition"
            >
              Hapus
            </button>
          </div>
        )}
      </main>

      {/* Footer Style GxyerBooth */}
      <footer className="max-w-3xl mx-auto w-full px-4 mt-6 z-20 flex flex-col items-center gap-2">
        <div className="flex items-center gap-4 text-zinc-500">
          <a
            href="https://github.com/Hakim-pixel"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-zinc-300 transition duration-200"
            title="GitHub"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482C19.138 20.197 22 16.44 22 12.017 22 6.484 17.522 2 12 2z"
              ></path>
            </svg>
          </a>
        </div>
        <div className="text-center text-[10px] font-semibold text-zinc-500 flex items-center justify-center select-none">
          <span>© 2026 Gxyervideo — All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
