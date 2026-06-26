const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function getTweetId(url) {
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

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
    if (qualities.length === 0) return res.status(500).json({ error: 'No video found in this tweet' });
    res.json({ title: data.text || 'Twitter Video', thumbnail, qualities });
  } catch(e) {
    res.status(500).json({ error: 'Could not fetch video.' });
  }
});

app.get('/video', (req, res) => {
  const format = req.query.format;
  if (!format) return res.status(400).send('No format');
  res.json({ status: 'processing', file: format });
});

app.get('/status', (req, res) => {
  const file = req.query.file;
  if (file) {
    res.json({ ready: true, url: '/proxy?v=' + file });
  } else {
    res.json({ ready: false });
  }
});

// PROXY - server se download karega
app.get('/proxy', (req, res) => {
  const v = req.query.v;
  console.log("Proxy URL:", v);
  if (!v) return res.status(400).send('No URL');
  const videoUrl = decodeURIComponent(v);
  
  res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
  res.setHeader('Content-Type', 'video/mp4');
  
  https.get(videoUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://twitter.com/',
      'Origin': 'https://twitter.com'
    }
  }, (videoRes) => {
    if (videoRes.statusCode === 301 || videoRes.statusCode === 302) {
      https.get(videoRes.headers.location, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://twitter.com/'
        }
      }, (r2) => {
        r2.pipe(res);
      });
    } else {
      videoRes.pipe(res);
    }
  }).on('error', (e) => {
    console.error(e);
    res.status(500).send('Download failed');
  });
});

app.get('/mp3', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL');
  const tweetId = getTweetId(url);
  if (!tweetId) return res.status(400).json({ error: 'Invalid URL' });
  try {
    const data = await fetchTweetData(tweetId);
    if (data.mediaDetails && data.mediaDetails[0] && data.mediaDetails[0].video_info) {
      const variants = data.mediaDetails[0].video_info.variants
        .sort((a, b) => (a.bitrate || 0) - (b.bitrate || 0));
      const audioUrl = variants[0].url;
      res.json({ status: 'processing', file: encodeURIComponent(audioUrl) });
    } else {
      res.status(500).json({ error: 'No audio found' });
    }
  } catch(e) {
    res.status(500).json({ error: 'Could not fetch audio' });
  }
});

app.get('/mp3file/:filename', (req, res) => {
  const v = req.params.filename;
  const audioUrl = decodeURIComponent(v);
  res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
  res.setHeader('Content-Type', 'audio/mpeg');
  https.get(audioUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://twitter.com/'
    }
  }, (audioRes) => {
    audioRes.pipe(res);
  }).on('error', () => res.status(500).send('Failed'));
});

app.listen(process.env.PORT || 3000, () => console.log('Server running!'));