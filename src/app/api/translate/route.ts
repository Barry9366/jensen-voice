import { NextResponse } from "next/server";

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
      const translatedText = result.response.text();
      
      if (translatedText) {
        const parts = translatedText.split(/\s*\|\|\|\s*/);
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

// Group items into batches where total text length stays under maxChars
function groupIntoBatches(texts: string[], maxChars = 3000): number[][] {
  const batches: number[][] = [];
  let current: number[] = [];
  let currentLen = 0;

  for (let i = 0; i < texts.length; i++) {
    const textLen = texts[i].length + 5; // 5 = " ||| "
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;
    const userApiKey = request.headers.get("x-gemini-api-key");

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "invalid_input", message: "請提供有效的英文文字段落" },
        { status: 400 }
      );
    }

    // Split text into sentences using punctuation (. ! ?)
    const rawParts = text.split(/([.!?]+(?:\s+|$))/);
    const sentences: string[] = [];
    for (let i = 0; i < rawParts.length; i += 2) {
      const textPart = rawParts[i];
      const punctPart = rawParts[i + 1] || "";
      if (textPart && textPart.trim()) {
        sentences.push((textPart + punctPart).trim());
      }
    }

    // Limit to maximum 10 sentences to keep translation reliable and fit UI slots
    const limitedSentences = sentences.slice(0, 10);

    if (limitedSentences.length === 0) {
      return NextResponse.json(
        { error: "no_sentences", message: "未能從輸入文字中解析出有效的英文句子" },
        { status: 400 }
      );
    }

    // Batch translate with MyMemory
    const batches = groupIntoBatches(limitedSentences);
    const translations: string[] = new Array(limitedSentences.length).fill("");

    const batchPromises = batches.map(async (batch) => {
      const texts = batch.map((idx) => limitedSentences[idx]);
      const translated = await translateBatch(texts, userApiKey);
      batch.forEach((idx, i) => {
        translations[idx] = translated[i] ?? "";
      });
    });
    await Promise.all(batchPromises);

    // Combine EN + ZH
    const result = limitedSentences.map((en, i) => ({
      en,
      zh: translations[i] || "",
    }));

    return NextResponse.json({ sentences: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "未知錯誤";
    return NextResponse.json(
      { error: "translation_failed", message: `翻譯過程中發生錯誤: ${errorMessage}` },
      { status: 500 }
    );
  }
}
