// app.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;

// POSTされたJSONデータをパースするためのミドルウェア
app.use(bodyParser.json());

// publicフォルダ内の静的ファイル（HTML, CSS, JSなど）を配信
app.use(express.static(path.join(__dirname, 'public')));

// ログファイルが保存されるディレクトリ
const logDir = path.join(__dirname, 'private', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

let currentMode = '出勤'; // 初期モードは「出勤」
let touchLogs = []; // タッチログを保存する配列

// IDmと社員情報を紐づけるデータをメモリ上にロード
let employeeData = {};
try {
  const data = fs.readFileSync(path.join(__dirname, 'private', 'data.json'), 'utf8');
  employeeData = JSON.parse(data);
  console.log('社員情報が正常に読み込まれました。');
} catch (err) {
  console.error('社員情報の読み込み中にエラーが発生しました:', err);
}

// 起動時に最新のログファイルを読み込む関数
function loadLatestLogFile() {
    try {
        const files = fs.readdirSync(logDir);
        // ファイル名を日付としてソート
        const latestFile = files.sort().reverse()[0];
        if (latestFile) {
            const data = fs.readFileSync(path.join(logDir, latestFile), 'utf8');
            touchLogs = JSON.parse(data);
            console.log(`最新のログファイル ${latestFile} を読み込みました。`);
        }
    } catch (err) {
        console.error('ログファイルの読み込み中にエラーが発生しました:', err);
    }
}

// 起動時に最新のログをロード
loadLatestLogFile();

// GET /api/status - UI表示用のAPI
// UIを閲覧するだけではisSyncedWithGasフラグは更新されない
app.get('/api/status', (req, res) => {
    res.status(200).json({
        mode: currentMode,
        logs: touchLogs
    });
});

// GET /api/gas-polling - GASポーリング専用のAPI
// このエンドポイントが呼ばれたときだけ、isSyncedWithGasフラグを更新
app.get('/api/gas-polling', (req, res) => {
    // 同期されていないすべてのログを見つける
    const unsyncedLogs = touchLogs.filter(log => log.isSyncedWithGas === false);
    
    if (unsyncedLogs.length > 0) {
        // 同期フラグを更新
        unsyncedLogs.forEach(log => {
            log.isSyncedWithGas = true;
        });
        
        // ファイルにも変更を保存
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(logDir, `${date}.json`);
        fs.writeFileSync(logFile, JSON.stringify(touchLogs, null, 2), 'utf8');
        
        console.log(`GASポーリングにより ${unsyncedLogs.length} 件のログが同期されました。`);
        
        res.status(200).json({
            success: true,
            syncedLogs: unsyncedLogs
        });
    } else {
        res.status(200).json({
            success: true,
            message: 'No unsynced logs to process.'
        });
    }
});

// POST /api/idm - C#アプリからIDmを受け取るAPI
app.post('/api/idm', (req, res) => {
    const idm = req.body.idm;
    if (idm) {
        // タイムスタンプを日本時間で生成
        const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const employeeInfo = employeeData[idm] || { employeeId: '不明', name: '不明' };
        
        const logEntry = { 
            idm: idm,
            employeeId: employeeInfo.employeeId,
            name: employeeInfo.name,
            mode: currentMode, 
            timestamp: timestamp,
            isSyncedWithGas: false // 新しいログは同期されていない状態
        };
        touchLogs.push(logEntry);

        // ログをJSONファイルに追記
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const logFile = path.join(logDir, `${date}.json`);
        fs.writeFileSync(logFile, JSON.stringify(touchLogs, null, 2), 'utf8');
        
        console.log(`[${timestamp}] ${currentMode} IDm: ${idm}, 社員番号: ${employeeInfo.employeeId}, 名前: ${employeeInfo.name}`);
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
