const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Tweet ID nikalta hai URL se
function getTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

// Twitter se video info laata hai
function fetchTweetData(tweetId) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=x`;
    https.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error')); }
      });
    }).on('error', reject);
  });
}

// /info route
app.get('/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const tweetId = getTweetId(url);
  if (!tweetId) return res.status(400).json({ error: 'Invalid Twitter/X URL' });

  try {
    const data = await fetchTweetData(tweetId);

    let qualities = [];
    let thumbnail = '';

    if (data.mediaDetails && data.mediaDetails.length > 0) {
      const media = data.mediaDetails[0];
      thumbnail = media.media_url_https || '';

      if (media.video_info && media.video_info.variants) {
        const variants = media.video_info.variants
          .filter(v => v.content_type === 'video/mp4')
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

        qualities = variants.map((v, i) => ({
          quality: i === 0 ? 'High Quality' : i === 1 ? 'Medium Quality' : 'Low Quality',
          format_id: encodeURIComponent(v.url),
          filesize: v.bitrate ? Math.round(v.bitrate / 1000) + ' kbps' : ''
        }));
      }
    }

    if (qualities.length === 0) {
      return res.status(500).json({ error: 'No video found in this tweet' });
    }

    res.json({
      title: data.text || 'Twitter Video',
      thumbnail: thumbnail,
      qualities: qualities
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'Could not fetch video.' });
  }
});

// /video route — seedha Twitter se download
app.get('/video', async (req, res) => {
  const format = req.query.format;
  if (!format) return res.status(400).send('No format');

  const videoUrl = decodeURIComponent(format);
  res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
  res.setHeader('Content-Type', 'video/mp4');

  https.get(videoUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, (stream) => {
    stream.pipe(res);
  }).on('error', (e) => {
    console.error(e);
    res.status(500).send('Download failed');
  });
});

app.listen(process.env.PORT || 3000, () => console.log('Server running!'));