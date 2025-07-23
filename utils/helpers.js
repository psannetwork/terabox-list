// ファイルサイズのフォーマット
function formatFileSize(bytes) {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 日付のフォーマット
function formatDate(dateString) {
  try {
    const date = new Date(dateString * 1000);
    return date.toLocaleString('ja-JP');
  } catch (error) {
    return '日付不明';
  }
}

// ファイルタイプの判定
function getFileType(fileName) {
  if (!fileName) return 'file';
  const ext = fileName.split('.').pop().toLowerCase();
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz'];
  const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'md'];
  
  if (imageTypes.includes(ext)) return 'image';
  if (archiveTypes.includes(ext)) return 'archive';
  if (documentTypes.includes(ext)) return 'document';
  return 'file';
}

module.exports = {
  formatFileSize,
  formatDate,
  getFileType
};