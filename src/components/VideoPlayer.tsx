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

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Reset time when video changes
  useEffect(() => {
    onTimeUpdate(0);
    setIsPlaying(false);
  }, [videoId, onTimeUpdate]);

  // Handle external seek requests
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && playerRef.current) {
      try {
        playerRef.current.seekTo(seekTime, true);
        playerRef.current.playVideo();
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
    playerRef.current.setPlaybackRate(playbackRate);
  };

  const handleStateChange = (event: YouTubeEvent) => {
    // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0
    if (event.data === 1) {
      setIsPlaying(true);
      startPolling();
    } else {
      setIsPlaying(false);
      stopPolling();
      // Report final time on pause/end
      if (playerRef.current) {
        try {
          onTimeUpdate(playerRef.current.getCurrentTime());
        } catch {}
      }
    }
  };

  const togglePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    }
  };

  const skipTime = (amount: number) => {
    if (playerRef.current) {
      const currentTime = playerRef.current.getCurrentTime();
      playerRef.current.seekTo(currentTime + amount, true);
    }
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(e.target.value);
    setPlaybackRate(rate);
    if (playerRef.current) {
      playerRef.current.setPlaybackRate(rate);
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

      {/* VoiceTube Style Playback Controls */}
      <div className="w-full flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 flex items-center justify-center bg-nvidia text-black rounded-full hover:bg-nvidia/80 transition-colors shadow-lg"
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>
          
          <button 
            onClick={() => skipTime(-5)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
            -5s
          </button>

          <button 
            onClick={() => skipTime(5)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors"
          >
            +5s
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">SPEED</span>
            <select
              value={playbackRate}
              onChange={handleRateChange}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs py-1 px-2 rounded outline-none focus:border-nvidia cursor-pointer"
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1.0x (Normal)</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
