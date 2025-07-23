const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ルート
app.use('/api', require('./routes/api'));

// メインページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Terabox Explorer がポート ${PORT} で起動しました`);
  console.log(`📍 http://localhost:${PORT} にアクセスしてください`);
});