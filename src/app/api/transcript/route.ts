import { YoutubeTranscript } from "youtube-transcript";
import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
import fs from "fs";
import path from "path";

export const maxDuration = 60; // Set Vercel function timeout to 60s

export interface TranscriptItem {
  text: string;
  offset: number;  // milliseconds
  duration: number; // milliseconds
  zh: string;      // Chinese translation
}

// Ensure cache directory exists
const CACHE_DIR = path.join(process.cwd(), ".cache", "transcripts");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.json`);
}

// Batch-translate English text to Traditional Chinese via MyMemory free API
async function translateBatch(texts: string[]): Promise<(string | null)[]> {
  const query = texts.join(" ||| ");
  if (!query.trim()) return texts.map(() => null);

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
    // Network error or timeout — return nulls
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
async function processTranscriptWithTranslation(rawTranscript: any[], isAiGenerated = false) {
  const MAX_ITEMS = 150;
  const limited = rawTranscript.slice(0, MAX_ITEMS);
  const batches = groupIntoBatches(limited);
  const translations: string[] = new Array(limited.length).fill("");

  for (const batch of batches) {
    const texts = batch.map((idx) => limited[idx].text);
    const translated = await translateBatch(texts);
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

  return new Promise<any[]>((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const audioStream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

    const tempFilePath = path.join(CACHE_DIR, `${videoId}_temp.webm`);
    const writeStream = fs.createWriteStream(tempFilePath);
    audioStream.pipe(writeStream);

    audioStream.on("error", (err) => reject(new Error("ytdl-core error: " + err.message)));

    writeStream.on("finish", async () => {
      try {
        const uploadResponse = await fileManager.uploadFile(tempFilePath, {
          mimeType: "audio/webm",
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
    // YouTube CC failed -> Fallback to Whisper AI
    try {
      rawTranscript = await generateTranscriptWithAI(videoId, userApiKey);
      isAiGenerated = true;
    } catch (err: any) {
      console.error("AI Generation failed:", err);
      return NextResponse.json(
        { error: "no_captions", message: `抓取字幕失敗，且 AI 生成也失敗 (${err.message})` },
        { status: 404 }
      );
    }
  }

  // 3. TRANSLATE & FORMAT
  const finalData = await processTranscriptWithTranslation(rawTranscript, isAiGenerated);

  // 4. SAVE TO CACHE
  fs.writeFileSync(cachePath, JSON.stringify(finalData), "utf-8");

  return NextResponse.json(finalData);
}
