import { YoutubeTranscript } from "youtube-transcript";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export const maxDuration = 60; // Set Vercel function timeout to 60s

export interface TranscriptItem {
  text: string;
  offset: number;  // milliseconds
  duration: number; // milliseconds
  zh: string;      // Chinese translation
}

// Ensure cache directory exists (use /tmp for serverless compatibility)
const CACHE_DIR = path.join(os.tmpdir(), "jensen_voice_transcripts");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.json`);
}

// Batch-translate English text to Traditional Chinese
async function translateBatch(texts: string[], userApiKey: string | null): Promise<(string | null)[]> {
  const query = texts.join(" ||| ");
  if (!query.trim()) return texts.map(() => null);

  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Translate the following English sentences into fluent Traditional Chinese (Taiwan). 
Maintain the exact same number of sentences. 
The sentences are separated by " ||| ".
Return the translation separated by " ||| ".
Do not add any additional text, notes, or formatting.

English text:
${query}`;

      const result = await model.generateContent(prompt);
      const translatedText = result.response.text();
      
      if (translatedText) {
        const parts = translatedText.split(" ||| ");
        if (parts.length === texts.length) {
          return parts.map((p: string) => p.trim());
        }
      }
    } catch (err) {
      console.error("Gemini translation failed, falling back to MyMemory", err);
    }
  }

  // Fallback to MyMemory
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=en|zh-TW`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return texts.map(() => null);

    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const parts = (data.responseData.translatedText as string).split(" ||| ");
      if (parts.length === texts.length) {
        return parts.map((p: string) => p.trim());
      }
    }
  } catch {
    // Network error or timeout
  }
  return texts.map(() => null);
}

// Group items into batches
function groupIntoBatches(items: { text: string }[], maxChars = 450): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let currentLen = 0;

  for (let i = 0; i < items.length; i++) {
    const textLen = items[i].text.length + 5; // 5 = " ||| "
    if (currentLen + textLen > maxChars && current.length > 0) {
      batches.push(current);
      current = [i];
      currentLen = textLen;
    } else {
      current.push(i);
      currentLen += textLen;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// Translate and structure transcript items
async function processTranscriptWithTranslation(rawTranscript: any[], isAiGenerated = false, userApiKey: string | null = null) {
  const MAX_ITEMS = 150;
  const limited = rawTranscript.slice(0, MAX_ITEMS);
  const batches = groupIntoBatches(limited);
  const translations: string[] = new Array(limited.length).fill("");

  for (const batch of batches) {
    const texts = batch.map((idx) => limited[idx].text);
    const translated = await translateBatch(texts, userApiKey);
    batch.forEach((idx, i) => {
      translations[idx] = translated[i] ?? "";
    });
  }

  const transcript: TranscriptItem[] = limited.map((item, i) => ({
    text: item.text,
    offset: item.offset,
    duration: item.duration,
    zh: translations[i] || "",
  }));

  return {
    transcript,
    total: rawTranscript.length,
    translated: limited.length,
    truncated: rawTranscript.length > MAX_ITEMS,
    isAiGenerated
  };
}

// removed duplicate imports

// Helper to get yt-dlp instance (downloads binary to /tmp if needed)
async function getYtDlpInstance() {
  const youtubedl = require('youtube-dl-exec');
  
  // check if default binary exists
  let defaultBin = '';
  try {
    defaultBin = require('youtube-dl-exec/src/constants').YOUTUBE_DL_PATH;
  } catch(e) {}
  
  if (defaultBin && fs.existsSync(defaultBin)) {
    return youtubedl;
  }

  // Fallback for Vercel or any environment where binary is missing
  const ytDlpPath = path.join(os.tmpdir(), 'yt-dlp_linux_bin');
  if (!fs.existsSync(ytDlpPath)) {
    console.log("Default yt-dlp missing. Downloading binary to /tmp...");
    const isWindows = os.platform() === 'win32';
    const binaryUrl = isWindows 
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
      
    const res = await fetch(binaryUrl);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(ytDlpPath, Buffer.from(buffer));
    if (!isWindows) {
      fs.chmodSync(ytDlpPath, 0o755);
    }
    console.log("yt-dlp downloaded and executable");
  }
  return youtubedl.create(ytDlpPath);
}

// Helper to get subtitles using yt-dlp
async function getSubtitlesWithYtDlp(videoId: string) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const yt = await getYtDlpInstance();
  const info = await yt(url, {
    dumpSingleJson: true,
    writeAutoSubs: true,
    subLangs: 'en',
    skipDownload: true,
    noWarnings: true,
    noCheckCertificate: true,
    extractorArgs: 'youtube:player_client=android', // Bypass bot protection
  });

  const subs = info.subtitles?.en || info.automatic_captions?.en;
  if (!subs || subs.length === 0) {
    throw new Error("No subtitles found via yt-dlp");
  }

  const json3Url = subs.find((s: any) => s.ext === 'json3')?.url;
  if (!json3Url) {
    throw new Error("No json3 subtitle format found");
  }

  const res = await fetch(json3Url);
  if (!res.ok) throw new Error("Failed to fetch json3 subtitle");
  const data = await res.json();

  const transcript: any[] = [];
  for (const event of data.events || []) {
    if (!event.segs) continue;
    const text = event.segs.map((s: any) => s.utf8).join("").trim();
    if (!text || text === "\\n") continue;
    transcript.push({
      text,
      offset: event.tStartMs,
      duration: event.dDurationMs || 0,
    });
  }
  return transcript;
}

// AI Gemini Fallback logic
async function generateTranscriptWithAI(videoId: string, userApiKey: string | null) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY for AI subtitle generation");
  }

  const { GoogleGenerativeAI } = require("@google/generative-ai");
  const { GoogleAIFileManager } = require("@google/generative-ai/server");

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  return new Promise<any[]>(async (resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const tempFilePath = path.join(CACHE_DIR, `${videoId}_temp.mp3`);

    try {
      const yt = await getYtDlpInstance();
      await yt(url, {
        extractAudio: true,
        audioFormat: 'mp3',
        output: tempFilePath,
        noWarnings: true,
        noCheckCertificate: true,
        preferFreeFormats: true,
        extractorArgs: 'youtube:player_client=android', // Bypass bot protection
      });

      // File is downloaded successfully, now upload to Gemini
      const uploadResponse = await fileManager.uploadFile(tempFilePath, {
        mimeType: "audio/mp3",
        displayName: `Audio ${videoId}`,
      });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `You are a professional transcriptionist. Listen to the audio and provide a complete transcript. 
You MUST output ONLY a valid JSON array of objects. Do not wrap it in markdown code blocks.
Each object must have exactly these three fields:
- text: The spoken sentence (string)
- offset: The start time of the sentence in milliseconds (integer)
- duration: The duration of the sentence in milliseconds (integer)

Example output:
[
  {"text": "Hello world.", "offset": 0, "duration": 1500},
  {"text": "Welcome to the video.", "offset": 1500, "duration": 2000}
]`;

        const result = await model.generateContent([
          {
            fileData: {
              mimeType: uploadResponse.file.mimeType,
              fileUri: uploadResponse.file.uri
            }
          },
          { text: prompt },
        ]);

        const responseText = result.response.text();
        const cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const data = JSON.parse(cleanText);
        if (!Array.isArray(data)) throw new Error("Gemini did not return an array");

        const rawTranscript = data.map((seg: any) => ({
          text: String(seg.text).trim(),
          offset: Number(seg.offset),
          duration: Number(seg.duration),
        }));

        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        
        try {
           await fileManager.deleteFile(uploadResponse.file.name);
        } catch (e) {}

        resolve(rawTranscript);
      } catch (err) {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        reject(err);
      }
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");
  const userApiKey = request.headers.get("x-gemini-api-key");

  if (!videoId || videoId.length !== 11) {
    return NextResponse.json({ error: "invalid_video_id", message: "請提供有效的 YouTube 影片 ID" }, { status: 400 });
  }

  const cachePath = getCachePath(videoId);

  // 1. CHECK CACHE
  if (fs.existsSync(cachePath)) {
    try {
      const cachedData = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      return NextResponse.json(cachedData);
    } catch {
      // Failed to read cache, proceed to fetch
    }
  }

  // 2. FETCH FROM YOUTUBE OR AI
  let rawTranscript: { text: string; offset: number; duration: number }[] = [];
  let isAiGenerated = false;

  try {
    // Try YouTube CC first
    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
    } catch {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
    }
  } catch {
    // YouTube CC failed -> Try yt-dlp for subtitles first
    try {
      rawTranscript = await getSubtitlesWithYtDlp(videoId);
    } catch (ytErr: any) {
      console.log("yt-dlp subtitles failed, falling back to AI audio extraction", ytErr);
      // Both failed -> Fallback to Whisper/Gemini AI
      try {
        rawTranscript = await generateTranscriptWithAI(videoId, userApiKey);
        isAiGenerated = true;
      } catch (err: any) {
        console.error("AI Generation failed:", err);
        const errStr = typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
        const ytErrStr = typeof ytErr === 'object' ? JSON.stringify(ytErr, Object.getOwnPropertyNames(ytErr)) : String(ytErr);
        return NextResponse.json(
          { error: "no_captions", message: `抓取字幕失敗 (YT: ${ytErrStr.substring(0,200)})，且 AI 生成也失敗 (AI: ${errStr.substring(0,200)})` },
          { status: 404 }
        );
      }
    }
  }

  // 3. TRANSLATE & FORMAT
  const finalData = await processTranscriptWithTranslation(rawTranscript, isAiGenerated, userApiKey);

  // 4. SAVE TO CACHE
  fs.writeFileSync(cachePath, JSON.stringify(finalData), "utf-8");

  return NextResponse.json(finalData);
}
