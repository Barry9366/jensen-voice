const play = require('play-dl');

async function testPlayDl() {
  const videoId = "q_HhB8jA30o";
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const stream = await play.stream(url, { discordPlayerCompatibility: true });
    console.log("Stream successfully acquired!", stream.type, stream.url);
  } catch (err) {
    console.error("Error with play-dl:", err.message);
  }
}

testPlayDl();
