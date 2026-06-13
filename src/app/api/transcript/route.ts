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
const CACHE_DIR = path.join(os.tmpdir(), "jensen_voice_transcripts_v4");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function getCachePath(videoId: string) {
  return path.join(CACHE_DIR, `${videoId}.json`);
}

let activeModelName: string | null = null;

async function getGenerativeModel(genAI: any) {
  if (activeModelName) {
    return genAI.getGenerativeModel({ model: activeModelName });
  }
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-2.0-flash"];
  const results = await Promise.all(
    models.map(async (name) => {
      try {
        const model = genAI.getGenerativeModel({ model: name });
        await model.generateContent("say ok");
        return name;
      } catch {
        return null;
      }
    })
  );
  const workingModel = results.find((r) => r !== null);
  if (workingModel) {
    activeModelName = workingModel;
    console.log(`[gemini] Selected model: ${activeModelName}`);
    return genAI.getGenerativeModel({ model: activeModelName });
  }
  activeModelName = "gemini-2.5-flash";
  return genAI.getGenerativeModel({ model: activeModelName });
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
      const model = await getGenerativeModel(genAI);
      
      const prompt = `Translate the following English sentences into fluent Traditional Chinese (Taiwan). 
Maintain the exact same number of sentences. 
The sentences are separated by " ||| ".
Return the translation separated by " ||| ".
Do not add any additional text, notes, or formatting.

English text:
${query}`;

      const result = await model.generateContent(prompt);
      let translatedText = result.response.text();
      // Sometimes Gemini adds markdown code blocks
      translatedText = translatedText.replace(/^```.*?\n/m, '').replace(/```$/m, '').trim();
      
      if (translatedText) {
        let parts = translatedText.split(/\s*\|\|\|\s*/);
        if (parts.length === texts.length) {
          return parts.map((p: string) => p.trim());
        } else {
          // If mismatch, translate individually as a fallback
          console.warn(`Translation mismatch: expected ${texts.length}, got ${parts.length}. Falling back to individual translation.`);
          const individualPromises = texts.map(async (text) => {
            try {
              const res = await model.generateContent(`Translate the following to fluent Traditional Chinese (Taiwan), return ONLY the translation:\n${text}`);
              let singleText = res.response.text().trim();
              return singleText.replace(/^```.*?\n/m, '').replace(/```$/m, '').trim();
            } catch {
              return null;
            }
          });
          return Promise.all(individualPromises);
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
      const parts = (data.responseData.translatedText as string).split(/\s*\|\|\|\s*/);
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
function groupIntoBatches(items: { text: string }[], maxChars = 1000): number[][] {
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

  const batchPromises = batches.map(async (batch) => {
    const texts = batch.map((idx) => limited[idx].text);
    const translated = await translateBatch(texts, userApiKey);
    batch.forEach((idx, i) => {
      translations[idx] = translated[i] ?? "";
    });
  });
  await Promise.all(batchPromises);

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

  console.log(`[yt-dlp] Available subtitle formats: ${subs.map((s: any) => s.ext).join(', ')}`);

  // Find any subtitle URL we can use as a base
  const baseEntry = subs.find((s: any) => s.url);
  if (!baseEntry?.url) {
    throw new Error("No subtitle URL found in yt-dlp data");
  }

  // Try srv1 format first (clean XML, no rolling duplicates)
  // Method 1: Look for srv1 entry directly
  // Method 2: Derive srv1 URL by changing format parameter in any existing URL
  const srv1Url = baseEntry.url.replace(/fmt=[a-z0-9]+/gi, 'fmt=srv1');
  console.log(`[yt-dlp] Trying srv1 URL (derived from ${baseEntry.ext})`);

  try {
    const res = await fetch(srv1Url);
    if (res.ok) {
      const xmlText = await res.text();
      const transcript: any[] = [];
      // Parse srv1 XML: <text start="0" dur="4.5">Hello world.</text>
      const regex = /<text[^>]+start="([^"]+)"[^>]+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
      let match;
      while ((match = regex.exec(xmlText)) !== null) {
        const start = parseFloat(match[1]) * 1000;
        const dur = parseFloat(match[2]) * 1000;
        // Decode HTML entities and strip tags
        const text = match[3]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim();
        if (text) {
          transcript.push({ text, offset: start, duration: dur });
        }
      }
      console.log(`[yt-dlp] srv1 parsed ${transcript.length} items`);
      if (transcript.length > 0) return transcript;
    } else {
      console.log(`[yt-dlp] srv1 fetch failed: ${res.status}`);
    }
  } catch (e: any) {
    console.log(`[yt-dlp] srv1 error: ${e.message}`);
  }

  // Fallback to json3 if srv1 unavailable
  console.log("[yt-dlp] Falling back to json3");
  const json3Entry = subs.find((s: any) => s.ext === 'json3');
  if (!json3Entry?.url) {
    throw new Error("No subtitle format found (tried srv1, json3)");
  }

  const res = await fetch(json3Entry.url);
  if (!res.ok) throw new Error("Failed to fetch json3 subtitle");
  const data = await res.json();

  // For json3, keep only the last event in each prefix chain
  const rawEvents: any[] = [];
  for (const event of data.events || []) {
    if (!event.segs) continue;
    const text = event.segs.map((s: any) => s.utf8).join("").replace(/\n/g, ' ').trim();
    if (!text) continue;
    rawEvents.push({
      text,
      offset: event.tStartMs,
      duration: event.dDurationMs || 0,
    });
  }

  const transcript: any[] = [];
  for (let i = 0; i < rawEvents.length; i++) {
    if (i + 1 < rawEvents.length && rawEvents[i + 1].text.startsWith(rawEvents[i].text)) {
      continue;
    }
    transcript.push(rawEvents[i]);
  }
  console.log(`[yt-dlp] json3 parsed ${rawEvents.length} raw -> ${transcript.length} deduped`);
  return transcript;
}



// ── Foolproof Fallback using youtube-transcript.ai ────────────────────────
async function fetchTranscriptFallback(videoId: string) {
  const res = await fetch(`https://youtube-transcript.ai/transcript/${videoId}.txt`);
  if (!res.ok) throw new Error("Fallback API returned " + res.status);
  const text = await res.text();

  const transcript: any[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^\[(?:(\d+):)?(\d+):(\d+)\]\s+(.*)/);
    if (match) {
      const hours = match[1] ? parseInt(match[1]) : 0;
      const mins = parseInt(match[2]);
      const secs = parseInt(match[3]);
      const offset = (hours * 3600 + mins * 60 + secs) * 1000;
      transcript.push({
        text: match[4].trim(),
        offset,
        duration: 5000
      });
    }
  }

  for (let i = 0; i < transcript.length - 1; i++) {
    transcript[i].duration = Math.max(1000, transcript[i+1].offset - transcript[i].offset);
  }

  if (transcript.length === 0) {
    throw new Error("No valid sentences parsed from fallback");
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

        const model = await getGenerativeModel(genAI);
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

  // 1. CHECK CACHE (validate it has non-empty translations)
  if (fs.existsSync(cachePath)) {
    try {
      const cachedData = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      const items = cachedData.transcript || [];
      const hasTranslations = items.length > 0 && items.filter((t: any) => t.zh).length > items.length * 0.3;
      const hasDuplicates = items.length > 0 && items.some((t: any) => t.text && t.text.length > 300);
      if (hasTranslations && !hasDuplicates) {
        return NextResponse.json(cachedData);
      } else {
        // Stale or dirty cache — delete and re-fetch
        fs.unlinkSync(cachePath);
        console.log(`Invalidated stale cache for ${videoId}`);
      }
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
      console.log(`[transcript] YoutubeTranscript (en) returned ${rawTranscript.length} items`);
    } catch {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
      console.log(`[transcript] YoutubeTranscript (any) returned ${rawTranscript.length} items`);
    }
  } catch (ccErr: any) {
    console.log(`[transcript] YoutubeTranscript failed: ${ccErr.message?.substring(0, 100)}`);
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
        // EVERYTHING FAILED -> Try the foolproof fallback text API
        try {
          console.log("Both yt-dlp and AI failed, attempting foolproof fallback API...");
          rawTranscript = await fetchTranscriptFallback(videoId);
          isAiGenerated = true; // Still requires translation, so we treat it similar
        } catch (fallbackErr: any) {
          console.error("Fallback API failed:", fallbackErr);
          const errStr = typeof err === 'object' ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : String(err);
          const ytErrStr = typeof ytErr === 'object' ? JSON.stringify(ytErr, Object.getOwnPropertyNames(ytErr)) : String(ytErr);
          return NextResponse.json(
            { error: "no_captions", message: `抓取字幕失敗 (YT: ${ytErrStr.substring(0,100)})，且 AI 生成也失敗 (AI: ${errStr.substring(0,100)})` },
            { status: 404 }
          );
        }
      }
    }
  }

  console.log(`[transcript] Final raw transcript: ${rawTranscript.length} items, first: "${rawTranscript[0]?.text?.substring(0, 80)}"`);

  // 3. TRANSLATE & FORMAT
  const finalData = await processTranscriptWithTranslation(rawTranscript, isAiGenerated, userApiKey);

  // 4. SAVE TO CACHE (Only if translations mostly succeeded)
  const missingCount = finalData.transcript.filter(t => !t.zh).length;
  if (finalData.transcript.length > 0 && missingCount < finalData.transcript.length * 0.5) {
    fs.writeFileSync(cachePath, JSON.stringify(finalData), "utf-8");
  } else {
    console.warn(`Skipping cache: too many missing translations (${missingCount}/${finalData.transcript.length})`);
  }

  return NextResponse.json(finalData);
}
