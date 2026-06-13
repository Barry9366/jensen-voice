import { YoutubeTranscript } from "youtube-transcript";

const videoId = "Sc48ToLIQAY";

try {
  let raw;
  try {
    raw = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" });
  } catch {
    raw = await YoutubeTranscript.fetchTranscript(videoId);
  }
  
  console.log(`Total items: ${raw.length}`);
  console.log("--- First 20 items ---");
  for (let i = 0; i < Math.min(20, raw.length); i++) {
    console.log(`[${i}] offset=${raw[i].offset} dur=${raw[i].duration} text="${raw[i].text}"`);
  }
  
  // Check for prefix patterns
  console.log("\n--- Prefix overlap analysis ---");
  let prefixCount = 0;
  for (let i = 0; i < raw.length - 1; i++) {
    const curr = raw[i].text.trim();
    const next = raw[i+1].text.trim();
    if (next.startsWith(curr)) {
      prefixCount++;
      if (prefixCount <= 5) {
        console.log(`Item ${i} is prefix of ${i+1}: "${curr}" -> "${next}"`);
      }
    }
  }
  console.log(`Total prefix overlaps: ${prefixCount} / ${raw.length}`);
  
  // Check for items with internal repetition
  console.log("\n--- Items with possible internal repetition ---");
  for (let i = 0; i < Math.min(50, raw.length); i++) {
    const words = raw[i].text.split(/\s+/);
    if (words.length > 6) {
      // Check if first 3 words appear again later in the same item
      const first3 = words.slice(0, 3).join(' ');
      const rest = words.slice(3).join(' ');
      if (rest.includes(first3)) {
        console.log(`[${i}] Internal repetition: "${raw[i].text}"`);
      }
    }
  }
} catch (e) {
  console.error("Error:", e.message);
}
