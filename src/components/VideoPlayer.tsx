"use client";

import React, { useState } from "react";
import { Play, Video, AlertCircle } from "lucide-react";

interface VideoPlayerProps {
  videoId: string;
  onVideoIdChange: (id: string) => void;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // Match standard, shortened, and embed YouTube URLs
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function VideoPlayer({ videoId, onVideoIdChange }: VideoPlayerProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="w-full flex flex-col items-center gap-4 bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative overflow-hidden group">
      {/* Visual cyber decoration */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nvidia to-transparent opacity-70"></div>
      
      {/* Header & Input Field */}
      <div className="w-full flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-nvidia/10 rounded-lg text-nvidia border border-nvidia/20">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-wide text-slate-100 flex items-center gap-2">
              JENSEN PLAYER <span className="text-xs font-mono px-2 py-0.5 rounded bg-nvidia/10 text-nvidia border border-nvidia/20">LIVE</span>
            </h2>
            <p className="text-xs text-slate-400">貼上任意 YouTube 網址即可更換練習影片</p>
          </div>
        </div>

        {/* Input Form */}
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
              <AlertCircle className="w-3. h-3" />
              {error}
            </span>
          )}
        </form>
      </div>

      {/* Embedded YouTube Player Iframe */}
      <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black relative shadow-[0_0_15px_rgba(0,0,0,0.8)] group-hover:border-nvidia/30 transition-all duration-500">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0&autoplay=0`}
          title="Jensen Huang Speech Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0 absolute top-0 left-0"
        ></iframe>
      </div>
    </div>
  );
}
