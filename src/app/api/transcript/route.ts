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

// AI Whisper Fallback logic
async function generateTranscriptWithAI(videoId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for AI subtitle generation");
  }

  return new Promise<any[]>((resolve, reject) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const audioStream = ytdl(url, { filter: "audioonly", quality: "highestaudio" });

    const chunks: Buffer[] = [];
    audioStream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    audioStream.on("error", (err) => reject(new Error("ytdl-core error: " + err.message)));

    audioStream.on("end", async () => {
      try {
        const audioBuffer = Buffer.concat(chunks);
        const fileBlob = new Blob([audioBuffer], { type: "audio/webm" });

        const formData = new FormData();
        formData.append("file", fileBlob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");
        formData.append("timestamp_granularities[]", "segment");

        const aiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}` },
          body: formData,
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          throw new Error("OpenAI API error: " + errText);
        }

        const data = await aiResponse.json();
        if (!data.segments) throw new Error("No segments returned from Whisper API");

        const rawTranscript = data.segments.map((seg: any) => ({
          text: seg.text.trim(),
          offset: Math.floor(seg.start * 1000),
          duration: Math.floor((seg.end - seg.start) * 1000),
        }));

        resolve(rawTranscript);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

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
      rawTranscript = await generateTranscriptWithAI(videoId);
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
