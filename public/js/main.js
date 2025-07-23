class TeraboxExplorer {
    constructor() {
        this.currentPath = '';
        this.basePath = '/shims'; // デフォルト値
        this.init();
    }

    async init() {
        console.log('🔧 Terabox Explorer 初期化中...');
        
        // サーバーから設定を取得
        try {
            const response = await fetch('/api/config');
            const config = await response.json();
            this.basePath = config.basePath || '/shims';
            console.log('📋 サーバー設定取得:', this.basePath);
        } catch (error) {
            console.log('⚠️ 設定取得失敗、デフォルトを使用:', this.basePath);
        }
        
        // 初回読み込み時はベースパスの内容を表示
        this.currentPath = this.basePath;
        console.log('📂 初期パス設定:', this.currentPath);
        
        await this.loadFiles();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const pathInput = document.getElementById('pathInput');
        pathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadFiles();
            }
        });
        
        // 初期値を設定
        pathInput.value = this.currentPath;
    }

    async loadFiles(path = null) {
        const loadingElement = document.getElementById('fileList');
        loadingElement.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>ファイルを読み込み中...</p>
            </div>
        `;

        try {
            // パスの決定ロジックを修正
            let targetPath;
            if (path !== null) {
                targetPath = path;
            } else {
                const inputPath = document.getElementById('pathInput').value;
                targetPath = inputPath || this.currentPath || this.basePath;
            }
            
            console.log('🔍 ファイル読み込みパス:', targetPath);
            
            const response = await fetch(`/api/files?path=${encodeURIComponent(targetPath)}`);
            const data = await response.json();

            if (data.success) {
                this.currentPath = data.path;
                this.updatePathInput();
                this.updateBreadcrumb();
                this.displayFiles(data.files);
            } else {
                this.showError('APIエラー: ' + data.message);
            }
        } catch (error) {
            console.error('❌ Fetch error:', error);
            this.showError('ファイルの読み込みに失敗しました: ' + error.message);
        }
    }

    updatePathInput() {
        document.getElementById('pathInput').value = this.currentPath;
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('breadcrumb');
        const pathParts = this.currentPath.split('/').filter(part => part !== '');
        
        let breadcrumbHTML = `<span class="breadcrumb-item" onclick="explorer.goToPath('${this.basePath}')">🏠</span>`;
        
        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath += '/' + part;
            const isLast = index === pathParts.length - 1;
            
            breadcrumbHTML += `
                <span class="breadcrumb-separator">/</span>
                <span class="breadcrumb-item ${isLast ? 'current-path' : ''}" 
                      onclick="explorer.goToPath('${currentPath}')">
                    ${part}
                </span>
            `;
        });

        breadcrumb.innerHTML = breadcrumbHTML;
    }

    displayFiles(files) {
        const fileListElement = document.getElementById('fileList');
        
        if (files.length === 0) {
            fileListElement.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>ファイルが見つかりません</h3>
                    <p>このディレクトリにはファイルがありません</p>
                </div>
            `;
            return;
        }

        let gridHTML = '<div class="file-grid">';
        
        files.forEach(file => {
            gridHTML += this.createFileItem(file);
        });
        
        gridHTML += '</div>';
        fileListElement.innerHTML = gridHTML;
    }

    createFileItem(file) {
        const iconClass = this.getFileIconClass(file);
        
        return `
            <div class="file-item" ${file.isDir ? `onclick="explorer.goToPath('${file.path}')"` : ''}>
                <div class="file-icon ${file.type}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div class="file-name">${this.escapeHtml(file.name)}</div>
                <div class="file-info">
                    ${file.isDir ? 'フォルダ' : `${file.size} • ${file.date}`}
                </div>
                ${!file.isDir ? `
                    <div class="file-actions">
                        <button class="btn-small btn-download" onclick="explorer.downloadFile('${file.id}', event)">
                            <i class="fas fa-download"></i> ダウンロード
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getFileIconClass(file) {
        if (file.isDir) return 'fa-folder';
        switch (file.type) {
            case 'image': return 'fa-file-image';
            case 'archive': return 'fa-file-archive';
            case 'document': return 'fa-file-pdf';
            case 'folder': return 'fa-folder';
            default: return 'fa-file';
        }
    }

    async downloadFile(fileId, event) {
        event.stopPropagation();
        
        try {
            // ローディング表示
            const button = event.target.closest('button');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 取得中...';
            button.disabled = true;
            // ボタンを元に戻す
            button.innerHTML = originalText;
            button.disabled = false;
            let downloadURL = `/api/download/${fileId}`
            const originalWindow = window.open(downloadURL, '_blank');
            
        } catch (error) {
            // ボタンを元に戻す
            const button = event.target.closest('button');
            button.innerHTML = '<i class="fas fa-download"></i> ダウンロード';
            button.disabled = false;
            console.error('ダウンロードエラー:', error);
            alert('ダウンロードに失敗しました: ' + error.message);
        }
    }
    
    goToPath(path) {
        this.currentPath = path;
        this.loadFiles(path);
    }

    goToRoot() {
        this.currentPath = this.basePath;
        this.loadFiles(this.basePath);
    }

    showError(message) {
        const fileListElement = document.getElementById('fileList');
        fileListElement.innerHTML = `
            <div class="error">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>エラー:</strong> ${this.escapeHtml(message)}
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// グローバルインスタンスの作成
let explorer;

// ページ読み込み完了時の処理
document.addEventListener('DOMContentLoaded', function() {
    explorer = new TeraboxExplorer();
    window.explorer = explorer; // グローバルに公開
    console.log('✅ Terabox Explorer 起動完了');
});