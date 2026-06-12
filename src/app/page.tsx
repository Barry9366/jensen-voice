"use client";

import React, { useState } from "react";
import { Terminal, Cpu, ShieldAlert, Sparkles, BookOpen } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import BilingualTranscript from "@/components/BilingualTranscript";
import RecordingSlots from "@/components/RecordingSlots";

interface Sentence {
  en: string;
  zh: string;
}

const DEFAULT_SENTENCES: Sentence[] = [
  {
    en: "Run, don't walk. Remember, either you are running for food, or you are running from becoming food.",
    zh: "奔跑吧，不要用走的。記住，你要麼是為了食物而奔跑，要麼是為了不成為食物而奔跑。"
  },
  {
    en: "To the graduates of 2023, you stand at the beginning of a major technology revolution.",
    zh: "2023 屆的畢業生們，你們正站在重大科技革命的起點。"
  },
  {
    en: "Agile companies will take advantage of AI and boost their position.",
    zh: "敏捷的企業將會利用 AI 的優勢，並提升自身的地位。"
  },
  {
    en: "GPU computing and generative AI have ignited the spark of a new era.",
    zh: "GPU 運算和生成式 AI 已經點燃了新時代的火花。"
  },
  {
    en: "The software industry is being reinvented from the ground up.",
    zh: "軟體產業正從根本上被重新發明。"
  }
];

export default function Home() {
  const [videoId, setVideoId] = useState("q_HhB8jA30o"); // Default: Jensen NTU commencement
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-nvidia selection:text-black">
      
      {/* Hacker grid background lines using standard CSS gradients */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none"></div>

      {/* Cyberpunk Top Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nvidia to-emerald-600 flex items-center justify-center text-black font-black shadow-lg shadow-nvidia/20 border border-nvidia/30 animate-pulse">
              <Cpu className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-nvidia via-nvidia-neon to-emerald-400 bg-clip-text text-transparent font-mono">
                  JENSEN VOICE
                </span>
                <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-nvidia border border-emerald-500/20">
                  v1.2.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">AI-Powered English Speech Master</p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-ping"></span>
              <span>DEV STATUS: STABLE</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Terminal className="w-3.5 h-3.5 text-nvidia-neon" />
              <span>TERMINAL ON</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Study Desk Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8 z-10">
        
        {/* Welcome Cyber Banner */}
        <section className="bg-gradient-to-r from-slate-950 via-[#0a1120] to-slate-950 border border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-nvidia/5 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5.5 h-5.5 text-nvidia" />
              歡迎來到「科技英語跟讀大師」
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              本平台專為科技人打造，結合 **黃仁勳 (Jensen Huang)** 的經典演講影片與詞彙。
              您可以點擊對照區單字即時翻譯、使用瀏覽器進行分句口說錄音，並將成果儲存至 Vercel Blob 雲端。
            </p>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 border border-slate-800 px-4 py-3.5 rounded-xl self-stretch md:self-auto text-slate-400">
            <BookOpen className="w-4 h-4 text-nvidia-neon" />
            <div>
              <div className="font-bold text-slate-300">STUDY SESSION ACTIVE</div>
              <div>{sentences.length} 句練習槽位 • 支援自訂</div>
            </div>
          </div>
        </section>

        {/* SECTION 1: YouTube Player Embed */}
        <section id="player-section">
          <VideoPlayer videoId={videoId} onVideoIdChange={setVideoId} />
        </section>

        {/* SECTION 2: Bilingual Transcript + Side Dictionary */}
        <section id="transcript-section">
          <BilingualTranscript
            sentences={sentences}
            onSentencesChange={setSentences}
            selectedSentenceIndex={selectedSentenceIndex}
            onSelectSentenceIndex={setSelectedSentenceIndex}
          />
        </section>

        {/* SECTION 3: Recording & Cloud slots */}
        <section id="recording-section">
          <RecordingSlots
            sentences={sentences}
            selectedSentenceIndex={selectedSentenceIndex}
          />
        </section>

      </main>

      {/* Cyberpunk Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500 font-mono mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Jensen Voice. Designed for Tech Innovators.</p>
          <div className="flex gap-4">
            <span className="hover:text-nvidia transition-colors">Vercel Blob Storage Ready</span>
            <span>•</span>
            <span className="hover:text-nvidia transition-colors">Web Audio API</span>
            <span>•</span>
            <span className="hover:text-nvidia transition-colors">Tailwind CSS v4</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
