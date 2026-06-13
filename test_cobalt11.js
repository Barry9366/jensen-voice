async function testCobalt11() {
  const videoId = "q_HhB8jA30o";
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const res = await fetch("https://co.wuk.sh/api/json", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: url,
        isAudioOnly: true
      })
    });

    const data = await res.json();
    console.log("Cobalt Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testCobalt11();
