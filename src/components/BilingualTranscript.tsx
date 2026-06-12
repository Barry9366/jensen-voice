"use client";

import React, { useState } from "react";
import { BookOpen, Edit3, X, HelpCircle, Sparkles, Check, RotateCcw } from "lucide-react";

interface Sentence {
  en: string;
  zh: string;
}

interface BilingualTranscriptProps {
  sentences: Sentence[];
  onSentencesChange: (sentences: Sentence[]) => void;
  selectedSentenceIndex: number;
  onSelectSentenceIndex: (index: number) => void;
}

// Mock dictionary with tech terms and key words from Jensen's speeches
const DICTIONARY: Record<string, { definition: string; pos: string; detail: string }> = {
  gpu: {
    pos: "n. (名詞)",
    definition: "圖形處理器 (Graphics Processing Unit)",
    detail: "NVIDIA 的核心加速運算晶片，也是現代人工智慧與深度學習最關鍵的算力引擎。"
  },
  ai: {
    pos: "n. (名詞)",
    definition: "人工智慧 (Artificial Intelligence)",
    detail: "利用電腦模擬、延伸和擴展人類智能的技術，目前正以生成式 AI 技術席捲全球。"
  },
  omniverse: {
    pos: "n. (名詞)",
    definition: "全能宇宙 (NVIDIA 模擬平台)",
    detail: "NVIDIA 研發的即時 3D 模擬與協作平台，主要用於工業數位孿生與物理精確的虛擬世界構建。"
  },
  revolution: {
    pos: "n. (名詞)",
    definition: "革命、重大變革",
    detail: "在此指由人工智慧（AI）與加速運算帶來的電腦科學史上的根本性重塑。"
  },
  generative: {
    pos: "adj. (形容詞)",
    definition: "生成式的、產生的",
    detail: "指能藉由機器學習算法，自動創作出全新的文字、影像、程式碼或音訊的 AI 領域。"
  },
  computing: {
    pos: "n. (名詞)",
    definition: "運算、計算技術",
    detail: "透過處理器進行資料編碼、運算並產生結果的過程。黃仁勳提倡加速運算已取代傳統通用運算。"
  },
  reinvented: {
    pos: "v. (動詞)",
    definition: "徹底改造、重新發明",
    detail: "把原有的事物、規則或產業，從根本架構上進行徹底推翻並重新建立。"
  },
  agile: {
    pos: "adj. (形容詞)",
    definition: "敏捷的、機敏的",
    detail: "指企業或個人能對多變的外部環境快速做出反應、迅速調整策略並執行。"
  },
  graduates: {
    pos: "n. (名詞)",
    definition: "畢業生",
    detail: "完成特定學校、學位或學術課程要求，取得畢業證書的學子。"
  },
  food: {
    pos: "n. (名詞)",
    definition: "食物、掠食資源",
    detail: "引申為生存所需的機遇、市場份額或核心競爭力；在商戰中若不奔跑，就會淪為他人的食物。"
  },
  run: {
    pos: "v. (動詞)",
    definition: "奔跑、運作",
    detail: "黃仁勳名言「Run, don't walk」中的關鍵動詞，勉勵人們要敏捷、快速捕捉科技轉折點。"
  },
  ignited: {
    pos: "v. (動詞)",
    definition: "點燃、激發",
    detail: "使某事物開始燃燒，在此指 GPU 運算與生成式 AI 正式啟動了全新科技時代的序幕。"
  },
  spark: {
    pos: "n. (名詞)",
    definition: "火花、導火線",
    detail: "微小但關鍵的火星，能引發全面的科技變革或思想潮流。"
  }
};

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

export default function BilingualTranscript({
  sentences,
  onSentencesChange,
  selectedSentenceIndex,
  onSelectSentenceIndex
}: BilingualTranscriptProps) {
  const [clickedWord, setClickedWord] = useState<string | null>(null);
  const [wordDef, setWordDef] = useState<{ definition: string; pos: string; detail: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editList, setEditList] = useState<Sentence[]>([...sentences]);

  // Clean punctuation and convert to lowercase for dictionary lookup
  const getCleanWord = (raw: string) => {
    return raw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "").toLowerCase();
  };

  const handleWordClick = (word: string) => {
    const cleaned = getCleanWord(word);
    if (!cleaned) return;

    setClickedWord(word);
    
    if (DICTIONARY[cleaned]) {
      setWordDef(DICTIONARY[cleaned]);
    } else {
      setWordDef({
        pos: "n./v./adj. (常用單字)",
        definition: `「${cleaned}」- 點擊的單字`,
        detail: "這是一個在演講中高頻出現的英語單字。點擊單字隨時進行聽力與口說比對，快跟著黃仁勳大師一起發音吧！"
      });
    }
  };

  const handleSaveEdits = () => {
    // Filter out blank sentences
    const filtered = editList.filter(s => s.en.trim() !== "");
    if (filtered.length === 0) {
      alert("請至少輸入一句英文練習句子");
      return;
    }
    onSentencesChange(filtered);
    onSelectSentenceIndex(0); // Reset select index to first sentence
    setIsEditing(false);
  };

  const handleResetDefault = () => {
    onSentencesChange(DEFAULT_SENTENCES);
    setEditList([...DEFAULT_SENTENCES]);
    onSelectSentenceIndex(0);
    setIsEditing(false);
  };

  const handleEditChange = (index: number, field: "en" | "zh", value: string) => {
    const newList = [...editList];
    newList[index] = { ...newList[index], [field]: value };
    setEditList(newList);
  };

  const handleAddRow = () => {
    if (editList.length >= 10) {
      alert("最多只能新增 10 句跟讀練習句子");
      return;
    }
    setEditList([...editList, { en: "", zh: "" }]);
  };

  const handleRemoveRow = (index: number) => {
    const newList = editList.filter((_, i) => i !== index);
    setEditList(newList);
  };

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      {/* Transcript Block */}
      <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-nvidia to-transparent opacity-70"></div>
        
        {/* Title & Actions */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-nvidia" />
            <h2 className="text-md font-bold text-slate-100 tracking-wider font-mono">BILINGUAL TRANSCRIPT / 中英對照練習區</h2>
          </div>
          
          <button
            onClick={() => {
              setEditList([...sentences]);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900/50 hover:bg-slate-800 hover:border-nvidia/40 text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            自訂跟讀句子
          </button>
        </div>

        {/* Sentences List */}
        <div className="flex flex-col gap-5 max-h-[380px] overflow-y-auto pr-2">
          {sentences.map((sentence, idx) => {
            const isSelected = selectedSentenceIndex === idx;
            // Split English sentence into words, retaining spacing
            const words = sentence.en.split(/\s+/);

            return (
              <div
                key={idx}
                onClick={() => onSelectSentenceIndex(idx)}
                className={`group border rounded-xl p-4 transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "bg-slate-900/80 border-nvidia/50 shadow-[0_0_12px_rgba(118,185,0,0.15)]"
                    : "bg-slate-950/30 border-slate-800/60 hover:bg-slate-900/30 hover:border-slate-700/80"
                }`}
              >
                {/* Sentence index & active status marker */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    isSelected ? "bg-nvidia text-black font-bold" : "bg-slate-800 text-slate-400"
                  }`}>
                    SLOT 0{idx + 1}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] text-nvidia font-mono flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-spin" /> ACTIVE STUDYING
                    </span>
                  )}
                </div>

                {/* English word button renderer */}
                <div className="text-base font-semibold leading-relaxed text-slate-100 tracking-wide flex flex-wrap gap-x-1.5 gap-y-1 mb-1.5">
                  {words.map((word, wIdx) => {
                    const cleaned = getCleanWord(word);
                    const isKeyWord = cleaned && DICTIONARY[cleaned];
                    return (
                      <button
                        key={wIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSentenceIndex(idx);
                          handleWordClick(word);
                        }}
                        className={`hover:text-nvidia hover:underline hover:scale-105 active:scale-95 transition-all text-left outline-none cursor-pointer ${
                          isKeyWord 
                            ? "text-nvidia-neon border-b border-dashed border-nvidia-neon/40 font-bold" 
                            : "text-slate-200"
                        }`}
                      >
                        {word}
                      </button>
                    );
                  })}
                </div>

                {/* Chinese Translation */}
                <p className={`text-sm tracking-wide ${isSelected ? "text-slate-300" : "text-slate-500 group-hover:text-slate-400"}`}>
                  {sentence.zh}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Translation Dictionary Card / Sidebar */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 shadow-2xl relative h-full lg:min-h-[460px] flex flex-col">
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
                <h3 className="text-2xl font-bold tracking-tight text-white mb-2 font-mono break-all">
                  {clickedWord.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")}
                </h3>
                <div className="text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-lg p-3 leading-relaxed">
                  {wordDef?.definition}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono text-slate-400 mb-1">TECH CONTEXT & DETAILED USAGE:</h4>
                <p className="text-xs leading-relaxed text-slate-400 font-sans">
                  {wordDef?.detail}
                </p>
              </div>
            </div>

            <button
              onClick={() => setClickedWord(null)}
              className="mt-6 w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs font-bold font-mono tracking-widest text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              CLEAR DICTIONARY CARD
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-12 h-12 rounded-full border border-dashed border-slate-800 flex items-center justify-center text-slate-500 mb-4 animate-pulse">
              ?
            </div>
            <p className="text-sm text-slate-400 font-mono mb-2">點選左側英文句子中的任何單字</p>
            <p className="text-xs text-slate-600 max-w-[200px]">
              點選後，將會在此處顯示該單字的中文翻譯與 NVIDIA 科技背景字彙卡。試試點選帶有 <span className="text-nvidia-neon underline">綠色底線</span> 的核心字彙！
            </p>
          </div>
        )}
      </div>

      {/* Edit sentences modal overlay */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-nvidia" /> CUSTOMIZE STUDY TRANSCRIPTS
                </h3>
                <p className="text-xs text-slate-500">可自訂 1 到 10 句中英對照跟讀練習句子，配對自選影片內容</p>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-900 p-2 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content list */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {editList.map((item, index) => (
                <div key={index} className="flex flex-col gap-2 p-3 bg-slate-900/40 border border-slate-800 rounded-xl relative group">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-nvidia">SENTENCE SLOT 0{index + 1}</span>
                    <button
                      onClick={() => handleRemoveRow(index)}
                      className="text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                    >
                      刪除
                    </button>
                  </div>
                  
                  <input
                    type="text"
                    value={item.en}
                    onChange={(e) => handleEditChange(index, "en", e.target.value)}
                    placeholder="輸入英文原句..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia/60 text-slate-200 text-sm px-3 py-2 rounded-lg outline-none"
                  />
                  <input
                    type="text"
                    value={item.zh}
                    onChange={(e) => handleEditChange(index, "zh", e.target.value)}
                    placeholder="輸入中文翻譯..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-nvidia/60 text-slate-200 text-sm px-3 py-2 rounded-lg outline-none"
                  />
                </div>
              ))}

              <button
                onClick={handleAddRow}
                className="w-full py-2.5 border border-dashed border-slate-800 hover:border-nvidia/50 bg-slate-900/10 hover:bg-slate-900/40 text-xs font-mono text-slate-400 hover:text-nvidia transition-all rounded-lg cursor-pointer"
              >
                + 新增一句練習槽位
              </button>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 flex items-center justify-between bg-slate-950">
              <button
                onClick={handleResetDefault}
                className="flex items-center gap-1 px-4 py-2 border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                回復預設黃仁勳名言
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="flex items-center gap-1 px-5 py-2 bg-nvidia text-black text-xs font-bold rounded-lg hover:bg-nvidia/90 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  保存變更
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
