const express = require('express');
const router = express.Router();
const uploaderModule = require('../config/terabox');
const { formatFileSize, formatDate, getFileType } = require('../utils/helpers');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const axios = require('axios');

require('dotenv').config();

// BASE_PATHをconfigから取得
const BASE_PATH = uploaderModule.BASE_PATH || process.env.BASE_PATH || '/shims';

console.log('🔧 APIルートのBASE_PATH:', BASE_PATH);

// パスの正規化関数
function normalizePath(path) {
  if (!path) return '/';
  
  // 先頭にスラッシュを追加
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  
  // 末尾のスラッシュを削除（ルートパスを除く）
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  
  // 連続するスラッシュを1つに
  path = path.replace(/\/+/g, '/');
  
  return path;
}

// ルート制限検証関数（完全版）
function isPathAllowed(requestPath) {
  const normalizedRequestPath = normalizePath(requestPath);
  const normalizedBasePath = normalizePath(BASE_PATH);
  
  console.log('🔍 パス検証:');
  console.log('   リクエストパス:', normalizedRequestPath);
  console.log('   ベースパス:', normalizedBasePath);
  
  // ベースパスがルートパスの場合
  if (normalizedBasePath === '/') {
    console.log('   ✅ ベースパスがルート: すべてのパスを許可');
    return true;
  }
  
  // 完全一致の場合
  if (normalizedRequestPath === normalizedBasePath) {
    console.log('   ✅ ベースパスと完全一致');
    return true;
  }
  
  // ベースパスで始まっているか確認（配下のパスを許可）
  if (normalizedRequestPath.startsWith(normalizedBasePath + '/')) {
    console.log('   ✅ ベースパスの配下パスを許可');
    return true;
  }
  
  console.log('   ❌ アクセス拒否: ベースパスの範囲外');
  return false;
}

// パスの安全性検証関数
function sanitizePath(path) {
  if (!path) return '/';
  
  // 基本的なパスの正規化
  let sanitized = path.toString().trim();
  
  // NULL文字の削除
  sanitized = sanitized.replace(/\0/g, '');
  
  // 危険な文字列の削除
  sanitized = sanitized.replace(/\.\./g, '');
  sanitized = sanitized.replace(/\\\./g, '');
  
  // 複数のスラッシュを1つに
  sanitized = sanitized.replace(/\/+/g, '/');
  
  // 先頭にスラッシュを追加
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }
  
  // 末尾のスラッシュを削除（ルートパスを除く）
  if (sanitized.length > 1 && sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }
  
  return sanitized;
}

// ダウンロードURLのドメイン変換関数（改善版）
function convertDownloadDomain(url) {
  try {
    const urlObj = new URL(url);
    
    // d.1024terabox.com を d.terabox.com に変換
    if (urlObj.hostname.includes('1024terabox.com')) {
      const newHostname = urlObj.hostname.replace('1024terabox.com', 'terabox.com');
      urlObj.hostname = newHostname;
      console.log('   ✅ ドメイン変換:', urlObj.hostname);
    }
    
    return urlObj.toString();
  } catch (error) {
    console.log('   ⚠️ ドメイン変換エラー:', error.message);
    return url;
  }
}

// ファイルリストの抽出関数
function extractFileList(response) {
  console.log('   📦 レスポンス解析中...');
  
  if (Array.isArray(response)) {
    console.log('   ✅ 直接配列形式');
    return response;
  }
  
  if (response && typeof response === 'object') {
    // 各種形式をチェック
    const possiblePaths = [
      'data.list',
      'list',
      'files',
      'result.list',
      'data.result'
    ];
    
    for (const path of possiblePaths) {
      let current = response;
      const keys = path.split('.');
      let found = true;
      
      for (const key of keys) {
        if (current && typeof current === 'object' && current[key]) {
          current = current[key];
        } else {
          found = false;
          break;
        }
      }
      
      if (found && Array.isArray(current)) {
        console.log(`   ✅ ${path} 形式で発見 (${current.length} items)`);
        return current;
      }
    }
    
    // 再帰的に探す
    const searchArray = (obj) => {
      if (Array.isArray(obj)) return obj;
      if (obj && typeof obj === 'object') {
        for (let key in obj) {
          const result = searchArray(obj[key]);
          if (result) return result;
        }
      }
      return null;
    };
    
    const foundArray = searchArray(response);
    if (foundArray) {
      console.log('   ✅ 再帰検索で配列を発見');
      return foundArray;
    }
  }
  
  console.log('   ⚠️ ファイルリストが見つかりません');
  return [];
}

// ディレクトリの内容を取得
router.get('/files', async (req, res) => {
  try {
    console.log('\n=== 📁 ファイル一覧リクエスト ===');
    
    let path = req.query.path || BASE_PATH;
    console.log('リクエストパス:', path);
    
    // パスのサニタイズ
    path = sanitizePath(path);
    console.log('サニタイズ後パス:', path);
    
    // ルート制限の適用
    if (!isPathAllowed(path)) {
      console.log('⚠️  ルート制限によりベースパスにリセット:', BASE_PATH);
      path = BASE_PATH;
    }
    
    console.log('最終使用パス:', path);
    
    // Terabox API呼び出し
    const response = await uploaderModule.fetchFileList(path);
    console.log('Raw response type:', typeof response);
    
    // ファイルリストの抽出
    const fileList = extractFileList(response);
    console.log('抽出されたファイル数:', fileList.length);
    
    // ファイル情報を整形
    const formattedFiles = fileList
      .map((file, index) => {
        console.log(`   ファイル ${index + 1}:`, file.server_filename || file.name || 'Unknown');
        
        return {
          id: file.fs_id || file.id || file.fid || '',
          name: file.server_filename || file.name || 'Unknown',
          size: formatFileSize(file.size || 0),
          date: formatDate(file.server_mtime || file.mtime || file.modified || Math.floor(Date.now()/1000)),
          isDir: (file.isdir === 1 || file.isDir === true || file.type === 'folder') ? true : false,
          type: (file.isdir === 1 || file.isDir === true) ? 'folder' : getFileType(file.server_filename || file.name || ''),
          path: file.path || file.fullPath || ''
        };
      })
      .filter(file => file.id && file.name !== 'Unknown'); // 無効なファイルを除外
    
    console.log('フォーマット後のファイル数:', formattedFiles.length);
    
    res.json({
      success: true,
      path: path,
      files: formattedFiles,
      basePath: BASE_PATH
    });
    
  } catch (error) {
    console.error('❌ ファイル一覧取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ファイル一覧の取得に失敗しました: ' + error.message,
      basePath: BASE_PATH
    });
  }
});

router.get('/download/:fsId', async (req, res) => {
  const fsId = req.params.fsId;

  if (!fsId) {
      return res.status(400).send('Bad Request: fsId is required');
  }

  try {
      console.log(`📥 ダウンロードリクエスト受信: fsId=${fsId}`);

      // 1. Terabox からダウンロードリンクを取得
      const teraboxRes = await uploaderModule.downloadFile(fsId);

      if (!teraboxRes.success || !teraboxRes.downloadLink) {
          console.error('❌ Terabox ダウンロードリンク取得失敗:', teraboxRes.message);
          return res.status(502).send('Bad Gateway: Failed to get download link from Terabox');
      }

      const downloadLink = teraboxRes.downloadLink;
      const ndusCookie = process.env.NDUS;

      if (!ndusCookie) {
          console.error('❌ 環境変数 NDUS が設定されていません');
          return res.status(500).send('Internal Server Error: Server configuration error');
      }

      console.log(`🔗 Terabox ダウンロードリンク取得成功: ${downloadLink}`);

      // 2. ndus クッキーを使って Terabox からファイルをストリームで取得
      const teraboxResponse = await axios({
          method: 'GET',
          url: downloadLink,
          headers: {
              'Cookie': `ndus=${ndusCookie}`
          },
          responseType: 'stream' // ストリームで受け取る
      });

      // 3. Terabox からのレスポンスヘッダーから情報を取得
      const contentDisposition = teraboxResponse.headers['content-disposition'];
      const contentType = teraboxResponse.headers['content-type'] || 'application/octet-stream'; // デフォルト
      const contentLength = teraboxResponse.headers['content-length'];

      console.log(`📡 Terabox からファイルストリーム取得開始: ${contentType}`);

      // 4. クライアントへのレスポンスヘッダーを設定
      // Content-Type は Terabox のものを使用
      res.setHeader('Content-Type', contentType);

      // Content-Disposition を設定して、ダウンロードとファイル名を指定
      if (contentDisposition) {
          res.setHeader('Content-Disposition', contentDisposition);
      } else {
          // Terabox からファイル名が来なかった場合のフォールバック
          res.setHeader('Content-Disposition', `attachment; filename="${fsId}"`);
      }

      // Content-Length があれば設定（プログレスバー表示のため）
      if (contentLength) {
          res.setHeader('Content-Length', contentLength);
      }

      // 5. Terabox のレスポンスストリームをクライアントのレスポンスにパイプ
      // これにより、データが Terabox から届くたびにクライアントに送信される
      teraboxResponse.data.pipe(res);

      console.log(`📤 クライアントへのファイルストリーム転送開始...`);

      // 6. ストリームの終了やエラーをハンドリング
      teraboxResponse.data.on('end', () => {
          console.log(`✅ クライアントへのファイル送信完了: fsId=${fsId}`);
      });

      teraboxResponse.data.on('error', (err) => {
          console.error(`❌ Terabox からのストリーム読み取りエラー:`, err);
          // クライアントへの接続がまだ切れていない場合のみエラー送信
          if (!res.headersSent) {
              res.status(502).send('Bad Gateway: Error reading stream from Terabox');
          }
      });

  } catch (error) {
      console.error(`❌ ダウンロード処理中にエラー発生 (fsId: ${fsId}):`, error);
      // エラーが発生し、まだヘッダーが送信されていない場合にエラーレスポンスを送る
      if (!res.headersSent) {
           if (error.response) {
               // Terabox からのエラーレスポンス (例: 404, 403)
               console.error(`   Terabox エラーステータス: ${error.response.status}`);
               res.status(error.response.status || 502).send(`Bad Gateway: Terabox error (${error.response.status})`);
           } else if (error.request) {
               // リクエストは送ったが応答がない
               res.status(504).send('Gateway Timeout: No response from Terabox');
           } else {
               // その他のエラー
               res.status(500).send('Internal Server Error');
           }
      }
      // ヘッダーが既に送信された後なら、Express が自動的に接続を閉じるか、
      // エラーがクライアントに送信されない可能性があるため、ログのみ記録
  }
});


// 設定情報取得（デバッグ用）
router.get('/config', (req, res) => {
  res.json({
    basePath: BASE_PATH,
    normalizedBasePath: normalizePath(BASE_PATH),
    env: {
      PORT: process.env.PORT,
      APP_ID: process.env.APP_ID ? '***' : 'NOT SET'
    }
  });
});

// パス検証（デバッグ用）
router.get('/validate-path', (req, res) => {
  const path = req.query.path || '/';
  const isValid = isPathAllowed(path);
  
  res.json({
    path: path,
    normalizedPath: normalizePath(path),
    isValid: isValid,
    basePath: BASE_PATH,
    normalizedBasePath: normalizePath(BASE_PATH)
  });
});

module.exports = router;