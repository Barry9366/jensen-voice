"use client";

import React, { useState, useRef, useEffect } from "react";
import YouTube, { YouTubeEvent, YouTubePlayer } from "react-youtube";
import { Play, Video, AlertCircle } from "lucide-react";

export interface LoopRange {
  start: number; // seconds
  end: number;   // seconds
}

interface VideoPlayerProps {
  videoId: string;
  onVideoIdChange: (id: string) => void;
  onTimeUpdate: (time: number) => void;
  loopRange?: LoopRange | null;
  onRepeat?: () => void;
  seekTime?: number | null;
  onSeekComplete?: () => void;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function VideoPlayer({ 
  videoId, 
  onVideoIdChange, 
  onTimeUpdate, 
  loopRange, 
  onRepeat,
  seekTime,
  onSeekComplete
}: VideoPlayerProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [error, setError] = useState("");
  const playerRef = useRef<YouTubePlayer | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Reset time when video changes
  useEffect(() => {
    onTimeUpdate(0);
  }, [videoId, onTimeUpdate]);

  // Handle external seek requests
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && playerRef.current) {
      try {
        playerRef.current.seekTo(seekTime, true);
      } catch (err) {
        console.warn("Failed to seek player:", err);
      }
      onSeekComplete?.();
    }
  }, [seekTime, onSeekComplete]);

  const startPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const time = playerRef.current.getCurrentTime();
          onTimeUpdate(time);

          // Loop: seek back when reaching end of loop range
          if (loopRange && time >= loopRange.end - 0.15) {
            playerRef.current.seekTo(loopRange.start, true);
            onRepeat?.();
          }
        } catch {
          // Player not ready yet
        }
      }
    }, 300);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleReady = (event: YouTubeEvent) => {
    playerRef.current = event.target;
  };

  const handleStateChange = (event: YouTubeEvent) => {
    // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
    if (event.data === 1) {
      startPolling();
    } else {
      stopPolling();
      // Report final time on pause/end
      if (playerRef.current) {
        try {
          onTimeUpdate(playerRef.current.getCurrentTime());
        } catch {}
      }
    }
  };

  const handleLoadVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!inputUrl.trim()) {
      setError("請輸入 YouTube 影片網址");
      return;
    }
    const id = extractYouTubeId(inputUrl);
    if (id) {
      onVideoIdChange(id);
      setInputUrl("");
    } else {
      setError("無效的 YouTube 網址，請確認後再試");
    }
  };

  const opts = {
    width: "100%",
    height: "100%",
    playerVars: {
      rel: 0,
      showinfo: 0,
      autoplay: 0,
      modestbranding: 1,
    },
  };

  return (
    <div className="w-full flex flex-col items-center gap-4 bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
      {/* Cyber top border glow */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nvidia to-transparent opacity-70"></div>

      {/* Header & Input */}
      <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-nvidia/10 rounded-lg text-nvidia border border-nvidia/20">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide text-slate-100 flex items-center gap-2">
              JENSEN PLAYER{" "}
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-nvidia/10 text-nvidia border border-nvidia/20">
                LIVE
              </span>
            </h2>
            <p className="text-xs text-slate-400">貼上任意 YouTube 網址即可更換練習影片</p>
          </div>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleLoadVideo} className="flex-1 max-w-xl flex flex-col gap-1.5">
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="貼上 YouTube 影片網址 (例如: https://www.youtube.com/watch?v=...)"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 focus:border-nvidia/70 text-slate-200 text-sm px-4 py-2.5 pr-28 rounded-lg outline-none transition-all duration-300 font-mono"
            />
            <button
              type="submit"
              className="absolute right-1 px-4 py-1.5 bg-nvidia hover:bg-nvidia/80 text-black text-xs font-bold rounded-md flex items-center gap-1 transition-all duration-300 active:scale-95 shadow-lg shadow-nvidia/20 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-black" />
              載入影片
            </button>
          </div>
          {error && (
            <span className="text-xs text-red-400 flex items-center gap-1 font-mono">
              <AlertCircle className="w-3 h-3" />
              {error}
            </span>
          )}
        </form>
      </div>

      {/* YouTube Player via react-youtube (for Player API access) */}
      <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black relative shadow-[0_0_15px_rgba(0,0,0,0.8)] group-hover:border-nvidia/30 transition-all duration-500">
        <YouTube
          key={videoId}
          videoId={videoId}
          opts={opts}
          onReady={handleReady}
          onStateChange={handleStateChange}
          className="absolute inset-0 w-full h-full"
          iframeClassName="w-full h-full border-0"
        />
      </div>
    </div>
  );
}
