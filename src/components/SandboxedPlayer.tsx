"use client";

import React, { useState, useRef } from "react";
import { Maximize, Minimize, RefreshCw, ExternalLink } from "lucide-react";

interface SandboxedPlayerProps {
  url: string;
  title?: string;
  originalUrl?: string;
}

export default function SandboxedPlayer({
  url,
  title,
  originalUrl,
}: SandboxedPlayerProps) {
  const [key, setKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
    >
      {/* Top Bar Minimalis */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between z-10">
        <span className="text-zinc-300 text-xs font-medium truncate max-w-xs sm:max-w-md">
          {title || "Player"}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
            title="Muat Ulang"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
              title="Buka Link Asli"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition"
            title={isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Sandboxed iframe */}
      <div className="relative flex-1 w-full bg-black">
        <iframe
          key={key}
          src={url}
          title={title || "Video Player"}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
