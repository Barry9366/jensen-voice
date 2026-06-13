const youtubedl = require('youtube-dl-exec');

async function testYtDlp() {
  const url = "https://youtu.be/2QLMaexoG40?si=b4ywlOaFIoOgxZDA";
  try {
    console.log("Testing yt-dlp with URL:", url);
    const output = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      noCheckCertificate: true
    });
    console.log("Success! Found video:", output.title);
  } catch (err) {
    console.error("Error with youtube-dl-exec:", err);
  }
}

testYtDlp();
