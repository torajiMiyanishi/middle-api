// app.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// POSTされたJSONデータをパースするためのミドルウェア
app.use(bodyParser.json());

// publicフォルダ内の静的ファイル（HTML, CSS, JSなど）を配信
app.use(express.static(path.join(__dirname, 'public')));

let currentMode = '出勤'; // 初期モードは「出勤」
let touchLogs = []; // タッチログを保存する配列

// GET /api/status - 現在のモードとログを返すAPI
app.get('/api/status', (req, res) => {
    res.status(200).json({
        mode: currentMode,
        logs: touchLogs
    });
});

// POST /api/idm - C#アプリからIDmを受け取るAPI
app.post('/api/idm', (req, res) => {
    const idm = req.body.idm;
    if (idm) {
        const timestamp = new Date().toLocaleString('ja-JP');
        // UIで選択されているモードをログに記録
        const logEntry = { idm: idm, mode: currentMode, timestamp: timestamp };
        touchLogs.push(logEntry);
        // ログのサイズを制限（例: 最新100件のみ保持）
        if (touchLogs.length > 100) {
            touchLogs.shift();
        }
        console.log(`[${timestamp}] ${currentMode} IDm: ${idm}`);
        res.status(200).json({ success: true, message: 'IDm received and logged.' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid IDm received.' });
    }
});

// POST /api/mode - UIからモード切り替えリクエストを受け取るAPI
app.post('/api/mode', (req, res) => {
    const newMode = req.body.mode;
    if (newMode === '出勤' || newMode === '退勤') {
        currentMode = newMode;
        console.log(`Mode switched to: ${currentMode}`);
        res.status(200).json({ success: true, newMode: currentMode });
    } else {
        res.status(400).json({ success: false, message: 'Invalid mode.' });
    }
});

const server = app.listen(port, () => console.log(`App listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
