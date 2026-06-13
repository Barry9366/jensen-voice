"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Terminal, Cpu, Sparkles, BookOpen, Repeat, X, RefreshCw, Settings } from "lucide-react";
import VideoPlayer, { LoopRange } from "@/components/VideoPlayer";
import BilingualTranscript, { TranscriptItem } from "@/components/BilingualTranscript";
import RecordingSlots from "@/components/RecordingSlots";

interface Sentence {
  en: string;
  zh: string;
}

const DEFAULT_SENTENCES: Sentence[] = [
  { en: "Run, don't walk. Remember, either you are running for food, or you are running from becoming food.", zh: "奔跑吧，不要用走的。記住，你要麼是為了食物而奔跑，要麼是為了不成為食物而奔跑。" },
  { en: "To the graduates of 2023, you stand at the beginning of a major technology revolution.", zh: "2023 屆的畢業生們，你們正站在重大科技革命的起點。" },
  { en: "Agile companies will take advantage of AI and boost their position.", zh: "敏捷的企業將會利用 AI 的優勢，並提升自身的地位。" },
  { en: "GPU computing and generative AI have ignited the spark of a new era.", zh: "GPU 運算和生成式 AI 已經點燃了新時代的火花。" },
  { en: "The software industry is being reinvented from the ground up.", zh: "軟體產業正從根本上被重新發明。" },
];

export default function Home() {
  const [videoId, setVideoId] = useState("Sc48ToLIQAY"); // Jensen Computex or similar working video
  const [currentTime, setCurrentTime] = useState(0);
  const [sentences, setSentences] = useState<Sentence[]>(DEFAULT_SENTENCES);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(0);

  // Auto transcript state
  const [autoTranscript, setAutoTranscript] = useState<TranscriptItem[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [transcriptError, setTranscriptError] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // BYOK Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");

  useEffect(() => {
    const savedKey = localStorage.getItem("jensen_voice_gemini_key");
    if (savedKey) setUserApiKey(savedKey);
  }, []);

  const handleSaveApiKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem("jensen_voice_gemini_key", key);
    setIsSettingsOpen(false);
  };

  // Loop / sentence repeat state
  const [loopRange, setLoopRange] = useState<LoopRange | null>(null);
  const [loopItemIndex, setLoopItemIndex] = useState<number | null>(null);
  const [loopItem, setLoopItem] = useState<TranscriptItem | null>(null);
  const [repeatCount, setRepeatCount] = useState(0);

  // Video seeking state
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // Track latest fetch to prevent race conditions
  const currentFetchIdRef = React.useRef(0);

  // Fetch transcript logic
  const fetchTranscript = useCallback(() => {
    if (!videoId) return;

    const fetchId = ++currentFetchIdRef.current;

    setAutoTranscript([]);
    setTranscriptError("");
    setIsAiGenerated(false);
    setCurrentTime(0);
    setLoopRange(null);
    setLoopItemIndex(null);
    setLoopItem(null);
    setRepeatCount(0);
    setIsLoadingTranscript(true);

    fetch(`/api/transcript?videoId=${videoId}`, {
      headers: {
        "x-gemini-api-key": userApiKey
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (fetchId !== currentFetchIdRef.current) return; // Ignore outdated fetch

        if (data.error) {
          setTranscriptError(data.message || "無法取得此影片的字幕");
          setAutoTranscript([]);
          setIsAiGenerated(false);
        } else {
          setTranscriptError(""); // Clear any lingering errors just in case
          setAutoTranscript(data.transcript || []);
          setIsAiGenerated(data.isAiGenerated || false);
        }
      })
      .catch(() => {
        if (fetchId !== currentFetchIdRef.current) return;
        setTranscriptError("網路錯誤，無法取得字幕");
      })
      .finally(() => {
        if (fetchId === currentFetchIdRef.current) {
          setIsLoadingTranscript(false);
        }
      });
  }, [videoId, userApiKey]);

  // Auto-fetch when videoId changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTranscript();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchTranscript]);

  const handleTimeUpdate = useCallback((time: number) => setCurrentTime(time), []);

  const handleSetLoop = useCallback((item: TranscriptItem, index: number) => {
    setLoopRange({ start: item.offset / 1000, end: (item.offset + item.duration) / 1000 });
    setLoopItemIndex(index);
    setLoopItem(item);
    setRepeatCount(0);
  }, []);

  const handleRepeat = useCallback(() => setRepeatCount((c) => c + 1), []);

  const handleClearLoop = useCallback(() => {
    setLoopItemIndex(null);
    setLoopItem(null);
    setLoopRange(null);
    setRepeatCount(0);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setSeekTime(time);
  }, []);

  const handleImportTranscript = useCallback((transcript: TranscriptItem[]) => {
    setAutoTranscript(transcript);
    setIsAiGenerated(false); // Can be overridden if needed
    setTranscriptError("");
  }, []);

  const handleSeekComplete = useCallback(() => {
    setSeekTime(null);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative selection:bg-nvidia selection:text-black">

      {/* Hacker grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-35 pointer-events-none"></div>

      {/* Top Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nvidia to-emerald-600 flex items-center justify-center shadow-lg shadow-nvidia/20 border border-nvidia/30 animate-pulse">
              <Cpu className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-nvidia via-nvidia-neon to-emerald-400 bg-clip-text text-transparent font-mono">
                  JENSEN VOICE
                </span>
                <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-nvidia border border-emerald-500/20">
                  v2.0.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">
                AI-Powered English Speech Master
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400">
            {isLoadingTranscript ? (
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-nvidia animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-ping"></span>
                <span>字幕準備中...</span>
              </div>
            ) : autoTranscript.length > 0 ? (
              <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-nvidia">
                <span className="w-1.5 h-1.5 rounded-full bg-nvidia"></span>
                <span>{autoTranscript.length} 句字幕已就緒</span>
              </div>
            ) : null}
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg">
              <Terminal className="w-3.5 h-3.5 text-nvidia-neon" />
              <span>LIVE</span>
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-nvidia/50 rounded-lg text-slate-400 hover:text-nvidia transition-colors"
              title="設定 API 金鑰"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8 z-10">

        {/* Welcome Banner */}
        <section className="bg-gradient-to-r from-slate-950 via-[#0a1120] to-slate-950 border border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-nvidia/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-nvidia" />
              歡迎來到「科技英語跟讀大師」
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              貼上任意 YouTube 演講網址，系統將自動抓取英文字幕並即時翻譯成中文。
              影片播放時，目前正在說的句子會自動高亮同步顯示。點擊任何單字可查詢科技字典！
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono bg-slate-950 border border-slate-800 px-4 py-3.5 rounded-xl self-stretch md:self-auto text-slate-400">
            <BookOpen className="w-4 h-4 text-nvidia-neon" />
            <div>
              <div className="font-bold text-slate-300">STUDY SESSION ACTIVE</div>
              <div>
                {autoTranscript.length > 0
                  ? `${autoTranscript.length} 句字幕 • 即時同步`
                  : `${sentences.length} 句自訂練習 • 手動模式`}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1 + 2: Video & Transcript side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">

          {/* Left: YouTube Player */}
          <section id="player-section" className="min-w-0">
            <VideoPlayer
              videoId={videoId}
              onVideoIdChange={setVideoId}
              onTimeUpdate={handleTimeUpdate}
              loopRange={loopRange}
              onRepeat={handleRepeat}
              seekTime={seekTime}
              onSeekComplete={handleSeekComplete}
            />
          </section>

          {/* Right: Bilingual Transcript + Dictionary */}
          <section id="transcript-section" className="min-w-0">
            <BilingualTranscript
              sentences={sentences}
              onSentencesChange={setSentences}
              selectedSentenceIndex={selectedSentenceIndex}
              onSelectSentenceIndex={setSelectedSentenceIndex}
              autoTranscript={autoTranscript}
              currentTime={currentTime}
              isLoadingTranscript={isLoadingTranscript}
              transcriptError={transcriptError}
              isAiGenerated={isAiGenerated}
              loopItemIndex={loopItemIndex}
              onSetLoop={handleSetLoop}
              onClearLoop={handleClearLoop}
              onSeek={handleSeek}
              onManualFetch={fetchTranscript}
              onImportTranscript={handleImportTranscript}
            />
          </section>

        </div>

        {/* SECTION 3: Recording - Practice Slots */}
        <section id="recording-section" className="min-w-0">
          <RecordingSlots
            sentences={sentences}
            selectedSentenceIndex={selectedSentenceIndex}
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-mono">
          <p>© 2026 Jensen Voice. Designed for Tech Innovators.</p>
          <div className="flex gap-4">
            <span className="hover:text-nvidia transition-colors">YouTube Transcript API</span>
            <span>•</span>
            <span className="hover:text-nvidia transition-colors">MyMemory 即時翻譯</span>
            <span>•</span>
            <span className="hover:text-nvidia transition-colors">Tailwind CSS v4</span>
          </div>
        </div>
      </footer>

      {/* ── Floating Loop Control Bar ── */}
      {loopItem && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
          <div className="bg-slate-950/95 backdrop-blur-md border border-nvidia/50 rounded-2xl px-5 py-4 shadow-2xl shadow-nvidia/10 flex items-center gap-4">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-nvidia/15 border border-nvidia/30 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-nvidia animate-spin" style={{ animationDuration: "2s" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold text-nvidia tracking-widest">LOOP PRACTICE</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-nvidia/15 text-nvidia border border-nvidia/20">× {repeatCount} 次</span>
              </div>
              <p className="text-sm font-semibold text-slate-100 truncate">{loopItem.text}</p>
              <p className="text-xs text-slate-400 truncate flex items-center gap-1 mt-0.5">
                <RefreshCw className="w-2.5 h-2.5 text-nvidia/60 shrink-0" />{loopItem.zh}
              </p>
            </div>
            <button onClick={handleClearLoop} className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer">
              <X className="w-3.5 h-3.5" />停止練習
            </button>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <Settings className="w-4 h-4 text-nvidia" />
                設定 Gemini API 金鑰
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                為了在雲端順利呼叫 AI 產生字幕，請輸入您個人的 Gemini API Key。這把金鑰只會保存在您的瀏覽器中，不會傳送到第三方伺服器。
              </p>
              <div>
                <label className="block text-xs font-mono text-slate-500 mb-1">GEMINI API KEY</label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  defaultValue={userApiKey}
                  id="geminiKeyInput"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia rounded-xl px-4 py-3 text-sm text-slate-200 outline-none transition-colors"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById("geminiKeyInput") as HTMLInputElement;
                  handleSaveApiKey(input?.value || "");
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-nvidia text-black hover:bg-emerald-400 transition-colors"
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
