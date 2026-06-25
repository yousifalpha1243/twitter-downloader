const express = require('express');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();

// yt-dlp install karo agar nahi hai
try {
  execSync('yt-dlp --version', { stdio: 'ignore' });
  console.log('yt-dlp already installed');
} catch(e) {
  console.log('Installing yt-dlp...');
  try {
    execSync('pip install yt-dlp', { stdio: 'inherit' });
    console.log('yt-dlp installed!');
  } catch(e2) {
    console.log('pip failed, trying pip3...');
    try {
      execSync('pip3 install yt-dlp', { stdio: 'inherit' });
    } catch(e3) {
      console.log('Trying curl install...');
      execSync('curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp', { stdio: 'inherit' });
    }
  }
}

const COOKIES = path.join(__dirname, 'cookies.txt');
const TEMP = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/info', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'URL required' });
  
  const cookieFlag = fs.existsSync(COOKIES) ? `--cookies "${COOKIES}"` : '';
  
  exec(`yt-dlp ${cookieFlag} --dump-json "${url}"`, { timeout: 30000 }, (error, stdout) => {
    if (error) return res.status(500).json({ error: 'Could not fetch video.' });
    try {
      const info = JSON.parse(stdout);
      const qualities = [];
      const seen = new Set();
      if (info.formats) {
        info.formats.forEach(f => {
          if (f.ext === 'mp4' && f.height && !seen.has(f.height)) {
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
      res.status(500).json({ error: 'Parse error' });
    }
  });
});

app.get('/video', (req, res) => {
  const url = req.query.url;
  const format = req.query.format || 'best';
  if (!url) return res.status(400).send('No URL');

  const filename = 'video_' + Date.now() + '.mp4';
  const filepath = path.join(TEMP, filename);
  const cookieFlag = fs.existsSync(COOKIES) ? `--cookies "${COOKIES}"` : '';

  res.json({ status: 'processing', file: filename });
  exec(`yt-dlp ${cookieFlag} -f ${format} -o "${filepath}" "${url}"`, { timeout: 120000 }, (error) => {
    if (error) console.error('Download error:', error);
  });
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

app.get('/mp3', (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL');
  const filename = 'audio_' + Date.now() + '.mp3';
  const filepath = path.join(TEMP, filename);
  const cookieFlag = fs.existsSync(COOKIES) ? `--cookies "${COOKIES}"` : '';
  res.json({ status: 'processing', file: filename });
  exec(`yt-dlp ${cookieFlag} -f bestaudio -o "${filepath}" "${url}"`, { timeout: 120000 }, (error) => {
    if (error) console.error('MP3 error:', error);
  });
});

app.get('/mp3file/:filename', (req, res) => {
  const filepath = path.join(TEMP, req.params.filename);
  if (!fs.existsSync(filepath)) return res.status(404).send('Not found');
  res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
  res.sendFile(filepath);
});

app.listen(3000, () => console.log('Server running on http://localhost:3000'));