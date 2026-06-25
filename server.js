exec(`${YT_DLP_PATH} ${cookieFlag} --dump-json "${url}"`, {
  timeout: 60000,
  maxBuffer: 1024 * 1024 * 10
}, (error, stdout, stderr) => {

  if (error) {
    console.log("STDOUT:");
    console.log(stdout);

    console.log("STDERR:");
    console.log(stderr);

    console.log("FULL ERROR:");
    console.log(error);

    return res.status(500).json({
      error: stderr || error.message || "yt-dlp failed"
    });
  }

  try {
    console.log("RAW OUTPUT:");
    console.log(stdout.substring(0, 1000));

    const info = JSON.parse(stdout);

    const qualities = [];
    const seen = new Set();

    if (info.formats) {
      info.formats.forEach(f => {
        if (f.height && !seen.has(f.height)) {
          seen.add(f.height);
          qualities.push({
            quality: f.height + 'p',
            height: f.height,
            format_id: f.format_id,
            filesize: f.filesize
              ? Math.round(f.filesize / 1024 / 1024) + ' MB'
              : ''
          });
        }
      });
    }

    qualities.sort((a, b) => b.height - a.height);

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      qualities:
        qualities.length > 0
          ? qualities
          : [{ quality: 'Default', format_id: 'best', filesize: '' }]
    });

  } catch (e) {

    console.log("JSON PARSE FAILED");
    console.log("STDOUT CONTENT:");
    console.log(stdout);

    console.log("PARSE ERROR:");
    console.log(e);

    return res.status(500).json({
      error: "Parse error",
      output: stdout.substring(0, 500)
    });
  }
});