"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  Settings,
  AlertTriangle,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  type?: "hls" | "mp4" | "webm" | "iframe";
  title?: string;
  poster?: string;
  formats?: Array<{
    format_id?: string;
    url: string;
    resolution?: string;
    quality?: string;
    ext?: string;
  }>;
  onFallbackToSandbox?: () => void;
}

export default function VideoPlayer({
  src,
  type = "mp4",
  title,
  poster,
  formats = [],
  onFallbackToSandbox,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentSrc, setCurrentSrc] = useState(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingProxy, setIsUsingProxy] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [skipIndicator, setSkipIndicator] = useState<{ dir: "left" | "right"; show: boolean }>({ dir: "right", show: false });

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const skipIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentSrc(src);
    setError(null);
    setIsUsingProxy(false);
  }, [src]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // HLS Setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSrc) return;

    let hls: Hls | null = null;
    const isHls = type === "hls" || currentSrc.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(currentSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!currentSrc.includes("/api/proxy")) {
                setCurrentSrc(`/api/proxy?url=${encodeURIComponent(currentSrc)}`);
              } else {
                hls?.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls?.recoverMediaError();
              break;
            default:
              hls?.destroy();
              setError("Gagal memutar video.");
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = currentSrc;
    } else {
      video.src = currentSrc;
    }

    return () => { if (hls) hls.destroy(); };
  }, [currentSrc, type, isUsingProxy]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch((err) => setError(err.message));
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const skipTime = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds));
    const dir = seconds > 0 ? "right" : "left";
    setSkipIndicator({ dir, show: true });
    if (skipIndicatorTimerRef.current) clearTimeout(skipIndicatorTimerRef.current);
    skipIndicatorTimerRef.current = setTimeout(() => setSkipIndicator(s => ({ ...s, show: false })), 700);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleVideoError = () => {
    if (!currentSrc.includes("/api/proxy")) {
      setCurrentSrc(`/api/proxy?url=${encodeURIComponent(currentSrc)}`);
    } else {
      setError("Video gagal dimuat.");
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  };

  // Click / Double-click on video area
  const handleVideoClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Ignore clicks on controls bar
    const target = e.target as HTMLElement;
    if (target.closest("[data-controls]")) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;

    if (clickTimerRef.current) {
      // Double click detected
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      skipTime(isLeft ? -10 : 10);
    } else {
      // Wait to see if double click follows
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        togglePlay();
      }, 220);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black overflow-hidden select-none flex flex-col justify-center items-center group"
    >
      {/* Video Element — no onClick here, handled by overlay */}
      <video
        ref={videoRef}
        poster={poster}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onError={handleVideoError}
        playsInline
        className="w-full h-full object-contain"
      />

      {/* Click / Double-click overlay (covers video area only, not controls) */}
      <div
        onClick={handleVideoClick}
        className="absolute inset-0 cursor-pointer z-10"
        style={{ bottom: "56px" }} // leave space for controls bar
      />

      {/* Skip Indicator */}
      {skipIndicator.show && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none transition-opacity ${
            skipIndicator.dir === "right" ? "right-8" : "left-8"
          }`}
        >
          <div className="bg-black/60 rounded-xl px-4 py-2 text-white text-sm font-bold backdrop-blur-sm">
            {skipIndicator.dir === "right" ? "▶▶ +10s" : "◀◀ -10s"}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-30">
          <AlertTriangle className="w-8 h-8 text-amber-400 mb-2" />
          <p className="text-zinc-200 text-xs font-semibold max-w-xs mb-3">{error}</p>
          <div className="flex gap-2">
            {onFallbackToSandbox && (
              <button
                onClick={onFallbackToSandbox}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold border border-zinc-700 transition"
              >
                Coba Sandboxed Frame
              </button>
            )}
            <button
              onClick={() => {
                setError(null);
                if (videoRef.current) videoRef.current.load();
              }}
              className="px-3 py-1.5 bg-white text-black rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reload
            </button>
          </div>
        </div>
      )}

      {/* Top Title Overlay */}
      {title && (
        <div
          className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-20 pointer-events-none ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-white text-xs font-bold truncate max-w-sm sm:max-w-md drop-shadow">
            {title}
          </p>
        </div>
      )}

      {/* Center Big Play Button */}
      {!isPlaying && !error && (
        <button
          onClick={togglePlay}
          className="absolute z-20 w-14 h-14 bg-white/95 hover:bg-white text-black rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          <Play className="w-6 h-6 ml-0.5 fill-current" />
        </button>
      )}

      {/* Bottom Controls Bar */}
      <div
        data-controls
        className={`absolute bottom-0 inset-x-0 px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-t from-black/95 via-black/70 to-transparent transition-opacity duration-300 z-30 flex flex-col gap-1.5 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Timeline Slider */}
        <div className="w-full flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-700/80 rounded-lg appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="p-1 hover:text-zinc-300 transition"
              title={isPlaying ? "Jeda" : "Putar"}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleMute}
                className="p-1 hover:text-zinc-300 transition"
                title={isMuted ? "Bunyikan" : "Bisukan"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-zinc-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="hidden sm:block w-14 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Time */}
            <span className="text-[11px] text-zinc-300 font-mono whitespace-nowrap ml-1">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                className="px-2 py-0.5 text-[11px] font-bold bg-zinc-800/90 hover:bg-zinc-700 rounded border border-zinc-700 transition"
              >
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-7 right-0 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[70px] z-40 text-[11px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => changeSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-left transition ${
                        playbackSpeed === spd
                          ? "bg-white text-black font-bold"
                          : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Formats Selector */}
            {formats.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                  className="p-1 hover:text-zinc-300 transition"
                  title="Kualitas"
                >
                  <Settings className="w-4 h-4" />
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-7 right-0 bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl p-1 flex flex-col gap-0.5 min-w-[100px] z-40 text-[11px]">
                    {formats.map((fmt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentSrc(fmt.url);
                          setShowQualityMenu(false);
                        }}
                        className="px-2 py-1 rounded text-left text-zinc-300 hover:bg-zinc-800 transition"
                      >
                        {fmt.resolution || `Kualitas ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:text-zinc-300 transition cursor-pointer"
              title={isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
