const TeraboxUploader = require("terabox-upload-tool");
require('dotenv').config();

console.log('🔧 Terabox認証情報の初期化中...');
console.log('Environment variables:');
console.log('- APP_ID:', process.env.APP_ID);
console.log('- BASE_PATH:', process.env.BASE_PATH);
console.log('- PORT:', process.env.PORT);

const BASE_PATH = process.env.BASE_PATH || '/shims';
console.log('Using BASE_PATH:', BASE_PATH);

const credentials = {
  ndus: process.env.NDUS,
  appId: process.env.APP_ID,
  uploadId: process.env.UPLOAD_ID,
  jsToken: process.env.JS_TOKEN,
  browserId: process.env.BROWSER_ID,
  bdstoken: process.env.BDSTOKEN
};

// 認証情報の検証
const missingCredentials = [];
Object.entries(credentials).forEach(([key, value]) => {
  if (!value) {
    missingCredentials.push(key);
  }
});

if (missingCredentials.length > 0) {
  console.warn('⚠️  次の認証情報が不足しています:', missingCredentials.join(', '));
} else {
  console.log('✅ すべての認証情報が設定されています');
}

const uploader = new TeraboxUploader(credentials);

module.exports = uploader;
module.exports.BASE_PATH = BASE_PATH;
module.exports.bdstoken = credentials.bdstoken;