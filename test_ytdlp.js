const youtubedl = require('youtube-dl-exec');
const fs = require('fs');

async function testYtDlp() {
  const videoId = "q_HhB8jA30o";
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  console.log("Testing youtube-dl-exec for URL:", url);
  try {
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    console.log("Success! Found video:", output.title);
  } catch (err) {
    console.error("Error with youtube-dl-exec:", err);
  }
}

testYtDlp();
