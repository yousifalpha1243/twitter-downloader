const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const YTDlpWrap = require('yt-dlp-wrap').default;
const app = express();

const TEMP = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const ytDlpWrap = new YTDlpWrap();

app.get('/info', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const info = await ytDlpWrap.getVideoInfo(url);
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
            filesize: f.filesize ? Math.round(f.filesize/1024/1024) + ' MB' : ''
          });
        }
      });
    }
    qualities.sort((a, b) => b.height - a.height);
    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      qualities: qualities.length > 0 ? qualities : [{ quality: 'Default', format_id: 'best', filesize: '' }]
    });
  } catch(e) {
    res.status(500).json({ error: 'Could not fetch video.' });
  }
});

app.get('/video', async (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'best';
  if (!url) return res.status(400).send('No URL');
  const filename = 'video_' + Date.now() + '.mp4';
  const filepath = path.join(TEMP, filename);
  res.json({ status: 'processing', file: filename });
  try {
    await ytDlpWrap.execPromise([url, '-f', format, '-o', filepath]);
  } catch(e) {
    console.error('Download error:', e);
  }
});

app.get('/status', (req, res) => {
  const file = req.query.file;
  const filepath = path.join(TEMP, file);
  if (fs.existsSync(filepath)) {
    res.json({ ready: true, url: '/file/' + file });
  } else {
    res.json({ ready: false });
  }
});

app.get('/file/:filename', (req, res) => {
  const filepath = path.join(TEMP, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
  res.sendFile(filepath);
  setTimeout(() => { try { fs.unlinkSync(filepath); } catch(e) {} }, 60000);
});

app.get('/mp3', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL');
  const filename = 'audio_' + Date.now() + '.mp3';
  const filepath = path.join(TEMP, filename);
  res.json({ status: 'processing', file: filename });
  try {
    await ytDlpWrap.execPromise([url, '-f', 'bestaudio', '-o', filepath]);
  } catch(e) {
    console.error('MP3 error:', e);
  }
});

app.get('/mp3file/:filename', (req, res) => {
  const filepath = path.join(TEMP, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
  res.sendFile(filepath);
});

app.listen(process.env.PORT || 3000, () => console.log('Server running!'));