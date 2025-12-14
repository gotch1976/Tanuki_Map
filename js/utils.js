// 便利な関数集

// ローディング表示
function showLoading(message = '読み込み中...') {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.textContent = message;
    loadingDiv.style.display = 'flex';
  }
}

// ローディング非表示
function hideLoading() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.style.display = 'none';
  }
}

// トースト通知を表示
function showToast(message, type = 'info', duration = 4000) {
  // トーストコンテナを取得または作成
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    document.body.appendChild(container);
  }

  // トースト要素を作成
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // アニメーション用に少し遅延
  setTimeout(() => toast.classList.add('show'), 10);

  // 自動で消去
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 成功メッセージ表示
function showSuccess(message) {
  showToast('✅ ' + message, 'success');
}

// エラーメッセージ表示
function showError(message) {
  showToast('❌ ' + message, 'error', 5000);
}

// 日付をフォーマット
function formatDate(timestamp) {
  if (!timestamp) return '';

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}年${month}月${day}日`;
}

// 画像をリサイズ
function resizeImage(file, maxWidth, maxHeight) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(e) {
      const img = new Image();

      img.onload = function() {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // アスペクト比を保ちながらリサイズ
        if (width > height) {
          if (width > maxWidth) {
            height = height * (maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = width * (maxHeight / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.85);
      };

      img.onerror = reject;
      img.src = e.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// URLパラメータを取得
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// 距離を計算(km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球の半径(km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance.toFixed(2);
}
