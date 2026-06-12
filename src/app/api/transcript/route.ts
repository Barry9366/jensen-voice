import { YoutubeTranscript } from "youtube-transcript";
import { NextResponse } from "next/server";

export interface TranscriptItem {
  text: string;
  offset: number;  // milliseconds
  duration: number; // milliseconds
  zh: string;      // Chinese translation
}

// Batch-translate English text to Traditional Chinese via MyMemory free API
// MyMemory free tier: ~1000 words/day, max 500 chars per request
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

// Group items into batches where total text length stays under maxChars
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId || videoId.length !== 11) {
    return NextResponse.json(
      { error: "invalid_video_id", message: "請提供有效的 YouTube 影片 ID" },
      { status: 400 }
    );
  }

  // 1. Fetch transcript (English first, then any language)
  let rawTranscript: { text: string; offset: number; duration: number }[] = [];
  try {
    rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  } catch {
    try {
      rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (e: any) {
      return NextResponse.json(
        {
          error: "no_captions",
          message: "此影片沒有可用的字幕，請選擇有開啟字幕的影片。",
        },
        { status: 404 }
      );
    }
  }

  // 2. Limit to first 150 items to keep translation time reasonable (~10-15 min of speech)
  const MAX_ITEMS = 150;
  const limited = rawTranscript.slice(0, MAX_ITEMS);

  // 3. Batch translate with MyMemory
  const batches = groupIntoBatches(limited);
  const translations: string[] = new Array(limited.length).fill("");

  for (const batch of batches) {
    const texts = batch.map((idx) => limited[idx].text);
    const translated = await translateBatch(texts);
    batch.forEach((idx, i) => {
      translations[idx] = translated[i] ?? "";
    });
  }

  // 4. Combine into final result
  const transcript: TranscriptItem[] = limited.map((item, i) => ({
    text: item.text,
    offset: item.offset,
    duration: item.duration,
    zh: translations[i] || "",
  }));

  return NextResponse.json({
    transcript,
    total: rawTranscript.length,
    translated: limited.length,
    truncated: rawTranscript.length > MAX_ITEMS,
  });
}
