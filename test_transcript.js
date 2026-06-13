const { YoutubeTranscript } = require('youtube-transcript');

async function testTranscript() {
  const url = "https://youtu.be/2QLMaexoG40?si=b4ywlOaFIoOgxZDA";
  console.log("Testing transcript for:", url);
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    console.log("Transcript found! Length:", transcript.length);
    console.log("First item:", transcript[0]);
  } catch (err) {
    console.error("Transcript error:", err.message);
  }
}

testTranscript();
