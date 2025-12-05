// 詳細ページ機能

let currentTanuki = null;
let miniMap = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // Firebase初期化
  if (!initFirebase()) {
    showError('Firebaseの初期化に失敗しました');
    return;
  }

  setupFirestore();

  // 認証初期化
  initAuth();

  // URLからたぬきIDを取得
  const tanukiId = getUrlParameter('id');
  if (!tanukiId) {
    showError('たぬきIDが指定されていません');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    return;
  }

  // たぬきデータを読み込み
  await loadTanukiDetail(tanukiId);

  // イベントリスナー
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 戻るボタン
  document.getElementById('backBtn')?.addEventListener('click', () => {
    window.history.back();
  });

  // 編集ボタン
  document.getElementById('editBtn')?.addEventListener('click', () => {
    // index.htmlに戻って編集モーダルを開く
    window.location.href = `index.html?edit=${currentTanuki.id}`;
  });

  // 削除ボタン
  document.getElementById('deleteBtn')?.addEventListener('click', deleteTanuki);
}

// たぬき詳細を読み込み
async function loadTanukiDetail(tanukiId) {
  try {
    showLoading('読み込み中...');

    const doc = await db.collection('tanukis').doc(tanukiId).get();

    if (!doc.exists) {
      hideLoading();
      showError('たぬきが見つかりません');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
      return;
    }

    currentTanuki = doc.data();
    currentTanuki.id = doc.id;

    displayTanukiDetail(currentTanuki);
    updateActionButtons(currentTanuki);

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('読み込みエラー:', error);
    showError('たぬきの読み込みに失敗しました');
  }
}

// たぬき詳細を表示
function displayTanukiDetail(tanuki) {
  // 写真(写真なし版では要素が存在しないのでスキップ)
  const tanukiPhoto = document.getElementById('tanukiPhoto');
  if (tanukiPhoto) {
    tanukiPhoto.src = tanuki.photoURL || '';
  }

  // エピソード
  document.getElementById('episode').textContent = tanuki.episode || '';

  // 場所
  if (tanuki.location) {
    const { latitude, longitude } = tanuki.location;
    document.getElementById('location').textContent =
      `緯度: ${latitude.toFixed(6)}, 経度: ${longitude.toFixed(6)}`;

    // ミニマップ表示
    initMiniMap(latitude, longitude);
  }

  // 特徴
  if (tanuki.characteristics) {
    document.getElementById('characteristics').textContent = tanuki.characteristics;
  }

  // 発見日
  if (tanuki.discoveryDate) {
    document.getElementById('discoveryDate').textContent = formatDate(tanuki.discoveryDate);
  }

  // 投稿者
  document.getElementById('poster').textContent = tanuki.userName || '不明';

  // note記事リンク
  if (tanuki.noteURL) {
    const noteSection = document.getElementById('noteSection');
    const noteLink = document.getElementById('noteLink');
    noteSection.style.display = 'block';
    noteLink.href = tanuki.noteURL;
  }
}

// ミニマップを初期化
function initMiniMap(latitude, longitude) {
  const mapDiv = document.getElementById('miniMap');
  if (!mapDiv) return;

  miniMap = new google.maps.Map(document.getElementById('miniMap'), {
    center: { lat: latitude, lng: longitude },
    zoom: 15
  });

  // マーカーを追加
  const marker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: miniMap,
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
  });

  const infoWindow = new google.maps.InfoWindow({
    content: '🦝 たぬきの場所'
  });
  infoWindow.open(miniMap, marker);
}

// アクションボタンの表示制御
function updateActionButtons(tanuki) {
  auth.onAuthStateChanged((user) => {
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (user && canEdit(tanuki.userId)) {
      if (editBtn) editBtn.style.display = 'inline-block';
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
      if (editBtn) editBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  });
}

// たぬきを削除
async function deleteTanuki() {
  if (!currentTanuki) return;

  const confirmed = confirm('本当にこのたぬきを削除しますか?\nこの操作は取り消せません。');
  if (!confirmed) return;

  try {
    showLoading('削除中...');

    // Storageから写真を削除
    if (currentTanuki.photoURL) {
      try {
        const photoRef = storage.refFromURL(currentTanuki.photoURL);
        await photoRef.delete();
      } catch (err) {
        console.warn('写真削除エラー:', err);
      }
    }

    if (currentTanuki.photoThumbnailURL) {
      try {
        const thumbRef = storage.refFromURL(currentTanuki.photoThumbnailURL);
        await thumbRef.delete();
      } catch (err) {
        console.warn('サムネイル削除エラー:', err);
      }
    }

    // Firestoreからドキュメントを削除
    await db.collection('tanukis').doc(currentTanuki.id).delete();

    hideLoading();
    showSuccess('削除しました');

    // ホームに戻る
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (error) {
    hideLoading();
    console.error('削除エラー:', error);
    showError('削除に失敗しました: ' + error.message);
  }
}
