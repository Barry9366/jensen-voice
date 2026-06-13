"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  BookOpen, Edit3, X, HelpCircle, Sparkles, Check, RotateCcw,
  Captions, Loader2, AlertTriangle, Languages, Repeat, Copy, Lock, Unlock,
} from "lucide-react";

export interface TranscriptItem {
  text: string;
  offset: number;  // ms
  duration: number; // ms
  zh: string;
}

interface Sentence {
  en: string;
  zh: string;
}

interface BilingualTranscriptProps {
  // Manual sentences (always available)
  sentences: Sentence[];
  onSentencesChange: (sentences: Sentence[]) => void;
  selectedSentenceIndex: number;
  onSelectSentenceIndex: (index: number) => void;
  // Auto transcript mode (from YouTube captions)
  autoTranscript: TranscriptItem[];
  currentTime: number; // seconds
  isLoadingTranscript: boolean;
  transcriptError: string;
  isAiGenerated?: boolean;
  // Loop (sentence repeat)
  loopItemIndex: number | null;
  onSetLoop: (item: TranscriptItem, index: number) => void;
  onClearLoop: () => void;
  onSeek: (time: number) => void;
  onManualFetch?: () => void;
  onImportTranscript?: (transcript: TranscriptItem[]) => void;
  videoId?: string;
}

// ── Mock dictionary ─────────────────────────────────────────────────────────
const DICTIONARY: Record<string, { definition: string; pos: string; detail: string }> = {
  gpu: { pos: "n. (名詞)", definition: "圖形處理器 (Graphics Processing Unit)", detail: "NVIDIA 的核心加速運算晶片，也是現代人工智慧與深度學習最關鍵的算力引擎。" },
  ai: { pos: "n. (名詞)", definition: "人工智慧 (Artificial Intelligence)", detail: "利用電腦模擬、延伸和擴展人類智能的技術，目前正以生成式 AI 技術席捲全球。" },
  omniverse: { pos: "n. (名詞)", definition: "全能宇宙 (NVIDIA 模擬平台)", detail: "NVIDIA 研發的即時 3D 模擬與協作平台，主要用於工業數位孿生與物理精確的虛擬世界構建。" },
  revolution: { pos: "n. (名詞)", definition: "革命、重大變革", detail: "在此指由人工智慧（AI）與加速運算帶來的電腦科學史上的根本性重塑。" },
  generative: { pos: "adj. (形容詞)", definition: "生成式的、產生的", detail: "指能藉由機器學習算法，自動創作出全新的文字、影像、程式碼或音訊的 AI 領域。" },
  computing: { pos: "n. (名詞)", definition: "運算、計算技術", detail: "透過處理器進行資料編碼、運算並產生結果的過程。黃仁勳提倡加速運算已取代傳統通用運算。" },
  reinvented: { pos: "v. (動詞)", definition: "徹底改造、重新發明", detail: "把原有的事物、規則或產業，從根本架構上進行徹底推翻並重新建立。" },
  agile: { pos: "adj. (形容詞)", definition: "敏捷的、機敏的", detail: "指企業或個人能對多變的外部環境快速做出反應、迅速調整策略並執行。" },
  run: { pos: "v. (動詞)", definition: "奔跑、運作", detail: "黃仁勳名言「Run, don't walk」中的關鍵動詞，勉勵人們要敏捷、快速捕捉科技轉折點。" },
  ignited: { pos: "v. (動詞)", definition: "點燃、激發", detail: "使某事物開始燃燒，在此指 GPU 運算與生成式 AI 正式啟動了全新科技時代的序幕。" },
  spark: { pos: "n. (名詞)", definition: "火花、導火線", detail: "微小但關鍵的火星，能引發全面的科技變革或思想潮流。" },
};

const DEFAULT_SENTENCES: Sentence[] = [
  { en: "Run, don't walk. Remember, either you are running for food, or you are running from becoming food.", zh: "奔跑吧，不要用走的。記住，你要麼是為了食物而奔跑，要麼是為了不成為食物而奔跑。" },
  { en: "To the graduates of 2023, you stand at the beginning of a major technology revolution.", zh: "2023 屆的畢業生們，你們正站在重大科技革命的起點。" },
  { en: "Agile companies will take advantage of AI and boost their position.", zh: "敏捷的企業將會利用 AI 的優勢，並提升自身的地位。" },
  { en: "GPU computing and generative AI have ignited the spark of a new era.", zh: "GPU 運算和生成式 AI 已經點燃了新時代的火花。" },
  { en: "The software industry is being reinvented from the ground up.", zh: "軟體產業正從根本上被重新發明。" },
];

export default function BilingualTranscript({
  sentences, onSentencesChange, selectedSentenceIndex, onSelectSentenceIndex,
  autoTranscript, currentTime, isLoadingTranscript, transcriptError, isAiGenerated,
  loopItemIndex, onSetLoop, onClearLoop,
  onSeek, onManualFetch, onImportTranscript, videoId
}: BilingualTranscriptProps) {
  const [clickedWord, setClickedWord] = useState<string | null>(null);
  const [wordDef, setWordDef] = useState<{ definition: string; pos: string; detail: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editList, setEditList] = useState<Sentence[]>([...sentences]);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // VoiceTube style language toggle
  const [displayLanguage, setDisplayLanguage] = useState<"en" | "ch" | "both">("both");

  // AI custom slot generation states
  const [aiInput, setAiInput] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState("");

  // Recording & Shadowing states
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [recordedAudioUrls, setRecordedAudioUrls] = useState<{ [index: number]: string }>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastActiveIndex, setLastActiveIndex] = useState<number>(0);

  // Determine active transcript index from current playback time
  const foundIndex = autoTranscript.findIndex((item) => {
    const startSec = item.offset / 1000;
    const endSec = (item.offset + item.duration) / 1000;
    return currentTime >= startSec && currentTime < endSec;
  });

  const activeTranscriptIndex = foundIndex !== -1 ? foundIndex : lastActiveIndex;

  const toggleRecording = async (index: number) => {
    if (recordingIndex === index) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setRecordingIndex(null);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const audioUrl = URL.createObjectURL(audioBlob);
          setRecordedAudioUrls((prev) => ({ ...prev, [index]: audioUrl }));
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setRecordingIndex(index);
      } catch (err) {
        console.error("Microphone access denied:", err);
        alert("無法存取麥克風，請確認瀏覽器權限設定。");
      }
    }
  };

  // Track the last active index to avoid blinking during gaps
  useEffect(() => {
    if (foundIndex !== -1) {
      const timer = setTimeout(() => setLastActiveIndex(foundIndex), 0);
      return () => clearTimeout(timer);
    }
  }, [foundIndex]);

  // Auto-scroll to active transcript item
  useEffect(() => {
    if (mode === "auto" && autoScrollEnabled && activeItemRef.current && scrollContainerRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeTranscriptIndex, mode, autoScrollEnabled]);

  // Switch to auto mode when transcript loads (asynchronously to satisfy ESLint)
  useEffect(() => {
    if (autoTranscript.length > 0) {
      const timer = setTimeout(() => setMode("auto"), 0);
      return () => clearTimeout(timer);
    }
  }, [autoTranscript.length]);

  // Switch to manual mode when no transcript (asynchronously to satisfy ESLint)
  useEffect(() => {
    if (!isLoadingTranscript && autoTranscript.length === 0 && !transcriptError) {
      const timer = setTimeout(() => setMode("manual"), 0);
      return () => clearTimeout(timer);
    }
  }, [isLoadingTranscript, autoTranscript.length, transcriptError]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCopyFullTranscript = () => {
    if (autoTranscript.length === 0) return;
    const formatted = autoTranscript
      .map((item) => `[${formatTime(item.offset)}] EN: ${item.text}\n[${formatTime(item.offset)}] 中: ${item.zh || "（無翻譯）"}`)
      .join("\n\n");

    navigator.clipboard.writeText(formatted)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy transcript:", err);
      });
  };

  const handleExportJson = () => {
    if (autoTranscript.length === 0) return;
    const jsonStr = JSON.stringify({ transcript: autoTranscript }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoId || "video"}_transcript.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleGenerateAiSentences = async () => {
    if (!aiInput.trim()) return;
    setIsGeneratingAi(true);
    setAiError("");
    try {
      const apiKey = localStorage.getItem("gemini_api_key") || "";
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-gemini-api-key": apiKey
        },
        body: JSON.stringify({ text: aiInput }),
      });
      const data = await res.json();
      if (res.ok && data.sentences) {
        setEditList(data.sentences);
        setAiInput("");
      } else {
        setAiError(data.message || "自動生成失敗，請稍後再試。");
      }
    } catch {
      setAiError("網路錯誤，無法連線至翻譯伺服器。");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const getCleanWord = (raw: string) => raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();

  const handleWordClick = async (word: string) => {
    const cleaned = getCleanWord(word);
    if (!cleaned) return;
    setClickedWord(cleaned);
    setWordDef({
      definition: "查詢中...",
      pos: "",
      detail: "正在從線上字典獲取即時解釋...",
    });

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleaned}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        const pos = entry.meanings[0]?.partOfSpeech || "";
        const definition = entry.meanings[0]?.definitions[0]?.definition || "查無解釋";
        const phonetics = entry.phonetics.find((p: any) => p.text)?.text || "";

        setWordDef({
          definition: definition,
          pos: phonetics ? `${pos} ${phonetics}` : pos,
          detail: "資料來源: Free Dictionary API",
        });
      } else {
        setWordDef({
          definition: "查無此單字",
          pos: "",
          detail: "可能是專有名詞、縮寫或是查無此字的變體形式。",
        });
      }
    } catch {
      setWordDef({
        definition: "查詢失敗",
        pos: "",
        detail: "無法連線至線上字典 API，請檢查網路連線。",
      });
    }
  };

  const handleSaveEdits = () => {
    const filtered = editList.filter((s) => s.en.trim() !== "");
    if (filtered.length === 0) { alert("請至少輸入一句英文練習句子"); return; }
    onSentencesChange(filtered);
    onSelectSentenceIndex(0);
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    onSentencesChange(DEFAULT_SENTENCES);
    setEditList([...DEFAULT_SENTENCES]);
    onSelectSentenceIndex(0);
    setIsEditing(false);
  };

  const isAutoMode = mode === "auto" && autoTranscript.length > 0;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result === "string") {
          const data = JSON.parse(result);
          if (data.transcript && Array.isArray(data.transcript)) {
            if (onImportTranscript) {
              onImportTranscript(data.transcript);
            }
          } else {
            alert("匯入的檔案不包含 transcript 欄位。");
          }
        }
      } catch (err) {
        alert("JSON 格式錯誤，無法匯入字幕。");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset
  };

  return (
    <div className="w-full flex flex-col gap-6">

      {/* ── Transcript / Sentences ── */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nvidia to-transparent opacity-70"></div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-nvidia" />
            <h2 className="text-md font-bold text-slate-100 tracking-wider font-mono">
              BILINGUAL TRANSCRIPT
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Import JSON Input */}
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleImportJson} 
            />
            {onImportTranscript && (
              <button
                onClick={() => fileInputRef.current?.click()}
                title="手動匯入 JSON 字幕檔"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-nvidia/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span className="text-[10px] font-mono hidden sm:inline">IMPORT JSON</span>
              </button>
            )}

            {isAutoMode && (
              <button
                onClick={handleExportJson}
                title="下載中英對照 JSON 字幕檔到本地"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-nvidia/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span className="text-[10px] font-mono hidden sm:inline">EXPORT JSON</span>
              </button>
            )}

            {/* Auto Scroll Toggle */}
            {isAutoMode && (
              <button
                onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                title={autoScrollEnabled ? "關閉自動滾動" : "開啟自動滾動"}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${autoScrollEnabled
                    ? "bg-nvidia/10 border-nvidia/35 text-nvidia hover:bg-nvidia/20"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                  }`}
              >
                {autoScrollEnabled ? <Lock className="w-3.5 h-3.5 animate-pulse" /> : <Unlock className="w-3.5 h-3.5" />}
                <span className="text-[10px] hidden sm:inline">{autoScrollEnabled ? "SCROLL ON" : "SCROLL OFF"}</span>
              </button>
            )}

            {/* Copy Full Transcript */}
            {isAutoMode && (
              <button
                onClick={handleCopyFullTranscript}
                title="複製整部影片的中英對照字幕"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-nvidia/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-nvidia animate-bounce" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-mono">{isCopied ? "COPIED" : "COPY ALL"}</span>
              </button>
            )}

            {/* Language toggle */}
            {isAutoMode && (
              <div className="flex text-[10px] font-mono rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
                <button
                  onClick={() => setDisplayLanguage("en")}
                  className={`px-3 py-1.5 transition-all cursor-pointer ${displayLanguage === "en" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setDisplayLanguage("ch")}
                  className={`px-3 py-1.5 transition-all cursor-pointer border-l border-slate-700 ${displayLanguage === "ch" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  中文
                </button>
                <button
                  onClick={() => setDisplayLanguage("both")}
                  className={`px-3 py-1.5 transition-all cursor-pointer border-l border-slate-700 ${displayLanguage === "both" ? "bg-nvidia text-black font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  雙語
                </button>
              </div>
            )}

            {/* Mode toggle */}
            {autoTranscript.length > 0 && (
              <div className="flex text-[10px] font-mono rounded-lg overflow-hidden border border-slate-800">
                <button
                  onClick={() => setMode("auto")}
                  className={`px-3 py-1.5 transition-all cursor-pointer ${mode === "auto" ? "bg-nvidia text-black font-bold" : "bg-slate-900 text-slate-400 hover:text-white"}`}
                >
                  <Captions className="w-3 h-3 inline mr-1" />AUTO 字幕
                </button>
                <button
                  onClick={() => setMode("manual")}
                  className={`px-3 py-1.5 transition-all cursor-pointer ${mode === "manual" ? "bg-nvidia text-black font-bold" : "bg-slate-900 text-slate-400 hover:text-white"}`}
                >
                  自訂句子
                </button>
              </div>
            )}
            {mode === "manual" && (
              <button
                onClick={() => { setEditList([...sentences]); setIsEditing(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-nvidia/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />自訂句子
              </button>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoadingTranscript && (
          <div className="flex items-center gap-3 p-4 border border-slate-800 rounded-xl bg-slate-900/40 mb-4">
            <Loader2 className="w-4 h-4 text-nvidia animate-spin shrink-0" />
            <div>
              <p className="text-sm font-mono text-slate-300">正在抓取並翻譯字幕...</p>
              <p className="text-xs text-slate-500">若無內建字幕，系統將自動下載音訊並使用 AI 語音辨識，這可能需要數十秒，請耐心等候。</p>
            </div>
          </div>
        )}

        {/* Transcript error */}
        {transcriptError && !isLoadingTranscript && (
          <div className="flex items-start gap-3 p-4 border border-amber-900/50 rounded-xl bg-amber-950/20 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-mono text-amber-300">{transcriptError}</p>
              <p className="text-xs text-slate-500 mt-1">已自動切換至「自訂句子」模式，可手動編輯練習句子。</p>
            </div>
          </div>
        )}

        {/* AUTO mode: YouTube captions with time-sync */}
        {isAutoMode && (
          <div ref={scrollContainerRef} className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-2">
            {autoTranscript.map((item, idx) => {
              const isActive = idx === activeTranscriptIndex;
              const isPast = currentTime > (item.offset + item.duration) / 1000;
              const words = item.text.split(/\s+/);
              const isLoopingThis = loopItemIndex === idx;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeItemRef : null}
                  onClick={() => onSeek(item.offset / 1000)}
                  title="點擊此句可跳轉影片播放時間"
                  className={`rounded-xl px-4 py-3 transition-all duration-300 border cursor-pointer ${isActive
                      ? "bg-nvidia/8 border-nvidia/60 shadow-[0_0_14px_rgba(118,185,0,0.18)] scale-[1.01]"
                      : isPast
                        ? "bg-slate-950/20 border-slate-900/30 opacity-50"
                        : "bg-slate-950/10 border-slate-800/30 hover:bg-slate-900/20"
                    }`}
                >
                  {isActive && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-nvidia animate-ping"></span>
                      <span className="text-[9px] font-mono text-nvidia font-bold tracking-widest">NOW PLAYING</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-2.5">
                      {/* English line */}
                      {displayLanguage !== "ch" && (
                        <div>
                          <span className="text-[10px] font-mono font-bold text-blue-400 tracking-wider uppercase">EN</span>
                          <div className="text-sm font-semibold leading-relaxed text-slate-100 flex flex-wrap gap-x-1.5 gap-y-0.5">
                            {words.map((word, wIdx) => {
                              const cleaned = getCleanWord(word);
                              return (
                                <button
                                  key={wIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWordClick(word);
                                  }}
                                  className={`hover:text-nvidia hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer ${cleaned && DICTIONARY[cleaned] ? "text-nvidia-neon border-b border-dashed border-nvidia-neon/40 font-bold" : ""
                                    }`}
                                >
                                  {word}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Chinese translation line */}
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-400 tracking-wider uppercase">中</span>
                        {item.zh ? (
                          <p className={`text-sm leading-relaxed ${isActive ? "text-amber-200" : "text-slate-300"}`}>
                            {item.zh}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-600 italic">翻譯無法取得</p>
                        )}
                      </div>
                    </div>
                    {/* Loop button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (loopItemIndex === idx) {
                          onClearLoop();
                        } else {
                          onSetLoop(item, idx);
                        }
                      }}
                      title={loopItemIndex === idx ? "停止重複練習" : "設為重複練習句"}
                      className={`shrink-0 mt-0.5 p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${loopItemIndex === idx
                          ? "bg-nvidia text-black border-nvidia shadow-[0_0_8px_rgba(118,185,0,0.4)] animate-pulse"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:border-nvidia/50 hover:text-nvidia"
                        }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MANUAL mode: user-defined sentences */}
        {!isAutoMode && !isLoadingTranscript && (
          <div className="flex flex-col gap-5 max-h-[380px] overflow-y-auto pr-2">
            {sentences.map((sentence, idx) => {
              const isSelected = selectedSentenceIndex === idx;
              const words = sentence.en.split(/\s+/);
              return (
                <div
                  key={idx}
                  onClick={() => onSelectSentenceIndex(idx)}
                  className={`group border rounded-xl p-4 transition-all duration-300 cursor-pointer ${isSelected ? "bg-slate-900/80 border-nvidia/50 shadow-[0_0_12px_rgba(118,185,0,0.15)]" : "bg-slate-950/30 border-slate-800/60 hover:bg-slate-900/30"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${isSelected ? "bg-nvidia text-black font-bold" : "bg-slate-800 text-slate-400"}`}>
                      SLOT 0{idx + 1}
                    </span>
                    {isSelected && <span className="text-[10px] text-nvidia font-mono flex items-center gap-1"><Sparkles className="w-3 h-3" /> ACTIVE</span>}
                  </div>
                  <div className="text-base font-semibold leading-relaxed text-slate-100 flex flex-wrap gap-x-1.5 gap-y-1 mb-1.5">
                    {words.map((word, wIdx) => {
                      const cleaned = getCleanWord(word);
                      return (
                        <button key={wIdx} onClick={(e) => { e.stopPropagation(); onSelectSentenceIndex(idx); handleWordClick(word); }}
                          className={`hover:text-nvidia hover:underline hover:scale-105 active:scale-95 transition-all outline-none cursor-pointer ${cleaned && DICTIONARY[cleaned] ? "text-nvidia-neon border-b border-dashed border-nvidia-neon/40 font-bold" : "text-slate-200"}`}>
                          {word}
                        </button>
                      );
                    })}
                  </div>
                  <p className={`text-sm tracking-wide flex items-center gap-1 ${isSelected ? "text-slate-300" : "text-slate-500 group-hover:text-slate-400"}`}>
                    <Languages className="w-3 h-3 shrink-0 text-nvidia/60" />
                    {sentence.zh}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dictionary Card ── */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative flex flex-col">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nvidia-neon to-transparent opacity-70"></div>
        <div className="border-b border-slate-800/80 pb-4 mb-4">
          <h2 className="text-md font-bold text-slate-100 tracking-wider font-mono flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-nvidia-neon" /> DICTIONARY / 單字隨身卡
          </h2>
        </div>

        {clickedWord ? (
          <div className="flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono text-nvidia-neon mb-1">{wordDef?.pos}</div>
                <h3 className="text-2xl font-bold text-white mb-2 font-mono break-all">
                  {clickedWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")}
                </h3>
                <div className="text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-lg p-3 leading-relaxed">
                  {wordDef?.definition}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-mono text-slate-400 mb-1">CONTEXT:</h4>
                <p className="text-xs leading-relaxed text-slate-400">{wordDef?.detail}</p>
              </div>
            </div>
            <button onClick={() => setClickedWord(null)} className="mt-6 w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold font-mono text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer">
              CLEAR
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center text-slate-500 mb-4 animate-pulse">?</div>
            <p className="text-sm text-slate-400 font-mono mb-2">點選任何英文單字</p>
            <p className="text-xs text-slate-600 max-w-[200px]">
              帶有 <span className="text-nvidia-neon underline">螢光綠底線</span> 的單字已收錄科技字典，點擊後顯示詳細說明。
            </p>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-nvidia" /> CUSTOMIZE TRANSCRIPTS
                </h3>
                <p className="text-xs text-slate-500">自訂 1 到 10 句中英對照練習句子</p>
              </div>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* AI Auto-generate Section */}
              <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-4 mb-4 font-sans">
                <h4 className="text-xs font-mono font-bold text-nvidia-neon mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-nvidia-neon" /> AI 段落自動分句與翻譯
                </h4>
                <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
                  貼上整段英文演講或文章，點擊後系統會自動進行英文斷句，並批次翻譯為繁體中文，快速填入自訂練習槽位。
                </p>
                <textarea
                  placeholder="在此貼上英文段落（例如：Welcome to the new era. NVIDIA is reinventing computing...）"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia/60 text-slate-200 text-xs p-3 rounded-lg outline-none resize-y mb-2 font-sans leading-relaxed"
                />
                {aiError && (
                  <p className="text-[11px] text-red-400 mb-2 font-mono">{aiError}</p>
                )}
                <button
                  type="button"
                  onClick={handleGenerateAiSentences}
                  disabled={isGeneratingAi || !aiInput.trim()}
                  className="w-full py-2 bg-nvidia hover:bg-nvidia/90 disabled:bg-slate-800 text-black disabled:text-slate-500 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      正在分句與翻譯中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      自動生成中英對照 (上限 10 句)
                    </>
                  )}
                </button>
              </div>

              {editList.map((item, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-slate-900/40 border border-slate-800 rounded-xl">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-nvidia">SENTENCE SLOT 0{index + 1}</span>
                    <button onClick={() => setEditList(editList.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-300 cursor-pointer">刪除</button>
                  </div>
                  <input type="text" value={item.en} onChange={(e) => { const l = [...editList]; l[index] = { ...l[index], en: e.target.value }; setEditList(l); }} placeholder="英文原句..." className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia/60 text-slate-200 text-sm px-3 py-2 rounded-lg outline-none" />
                  <input type="text" value={item.zh} onChange={(e) => { const l = [...editList]; l[index] = { ...l[index], zh: e.target.value }; setEditList(l); }} placeholder="中文翻譯..." className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia/60 text-slate-200 text-sm px-3 py-2 rounded-lg outline-none" />
                </div>
              ))}
              {editList.length < 10 && (
                <button onClick={() => setEditList([...editList, { en: "", zh: "" }])} className="w-full py-2.5 border border-dashed border-slate-800 hover:border-nvidia/50 text-xs font-mono text-slate-400 hover:text-nvidia transition-all rounded-lg cursor-pointer">
                  + 新增槽位
                </button>
              )}
            </div>
            <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950">
              <button onClick={handleResetDefault} className="flex items-center gap-1 px-4 py-2 border border-slate-800 bg-slate-900 text-slate-400 hover:text-white text-xs font-bold rounded-lg cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" />回復預設
              </button>
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-lg cursor-pointer">取消</button>
                <button onClick={handleSaveEdits} className="flex items-center gap-1 px-5 py-2 bg-nvidia text-black text-xs font-bold rounded-lg hover:bg-nvidia/90 cursor-pointer">
                  <Check className="w-3.5 h-3.5" />保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
