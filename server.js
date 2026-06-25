const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();

const COOKIES = path.join(__dirname, 'cookies.txt');
const TEMP = path.join(__dirname, 'temp');
if (!fs.existsSync(TEMP)) fs.mkdirSync(TEMP);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));