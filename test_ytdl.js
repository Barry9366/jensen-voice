const ytdl = require("@distube/ytdl-core");

async function testYtdl() {
  const videoId = "q_HhB8jA30o";
  console.log("Testing ytdl-core with video ID:", videoId);
  try {
    const info = await ytdl.getInfo(videoId);
    console.log("Success! Video title:", info.videoDetails.title);
  } catch (err) {
    console.error("ytdl-core error:", err.message);
  }
}

testYtdl();
