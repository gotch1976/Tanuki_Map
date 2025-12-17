// リストビュー機能

// グローバル変数
let allTanukis = [];
let tanukiRatings = {}; // tanukiId -> { avg, count }

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

  // たぬきリストを読み込み
  await loadTanukiList();

  // イベントリスナー
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 戻るボタン
  document.getElementById('backBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // ソート変更
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    sortAndDisplayTanukis(e.target.value);
  });
}

// たぬきリストを読み込み
async function loadTanukiList() {
  try {
    showLoading('たぬきを読み込み中...');

    const snapshot = await db.collection('tanukis')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .get();

    const tanukiList = document.getElementById('tanukiList');
    const tanukiCount = document.getElementById('tanukiCount');

    if (snapshot.empty) {
      tanukiList.innerHTML = '<p class="no-data">まだたぬきが登録されていません</p>';
      tanukiCount.textContent = '0件のたぬき';
      hideLoading();
      return;
    }

    // データを配列に格納
    allTanukis = [];
    snapshot.forEach((doc) => {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      allTanukis.push(tanuki);
    });

    tanukiCount.textContent = `${allTanukis.length}件のたぬき`;

    // 評価を取得（並行処理）
    await loadAllRatings();

    // 初期表示（日付順）
    sortAndDisplayTanukis('date');

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('読み込みエラー:', error);
    showError('たぬきの読み込みに失敗しました');
  }
}

// 全たぬきの評価を取得
async function loadAllRatings() {
  const promises = allTanukis.map(async (tanuki) => {
    try {
      const ratingsSnapshot = await db.collection('tanukis')
        .doc(tanuki.id).collection('ratings').get();

      if (ratingsSnapshot.size > 0) {
        let total = 0;
        ratingsSnapshot.forEach(doc => total += doc.data().rating);
        tanukiRatings[tanuki.id] = {
          avg: total / ratingsSnapshot.size,
          count: ratingsSnapshot.size
        };
      } else {
        tanukiRatings[tanuki.id] = { avg: 0, count: 0 };
      }
    } catch (e) {
      console.warn('評価取得エラー:', tanuki.id, e);
      tanukiRatings[tanuki.id] = { avg: 0, count: 0 };
    }
  });

  await Promise.all(promises);
}

// ソートして表示
function sortAndDisplayTanukis(sortType) {
  let sorted = [...allTanukis];

  switch (sortType) {
    case 'date':
      // 日付順（新しい順）
      sorted.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      break;

    case 'prefecture':
      // 都道府県別（あいうえお順、未設定は最後）
      sorted.sort((a, b) => {
        const prefA = a.prefecture || 'ん';
        const prefB = b.prefecture || 'ん';
        return prefA.localeCompare(prefB, 'ja');
      });
      break;

    case 'rating':
      // 評価順（高い順、未評価は最後）
      sorted.sort((a, b) => {
        const ratingA = tanukiRatings[a.id]?.avg || 0;
        const ratingB = tanukiRatings[b.id]?.avg || 0;
        return ratingB - ratingA;
      });
      break;
  }

  // 表示
  const tanukiList = document.getElementById('tanukiList');
  tanukiList.innerHTML = '';
  sorted.forEach(tanuki => {
    tanukiList.appendChild(createTanukiCard(tanuki));
  });
}

// たぬきカードを作成
function createTanukiCard(tanuki) {
  const card = document.createElement('div');
  card.className = 'tanuki-card';
  card.onclick = () => {
    window.location.href = `detail.html?id=${tanuki.id}`;
  };

  // エピソードのプレビュー(最初の100文字)
  const episodePreview = tanuki.episode.length > 100
    ? tanuki.episode.substring(0, 100) + '...'
    : tanuki.episode;

  // サムネイル画像のURL（なければデフォルト画像）
  const thumbnailURL = tanuki.photoThumbnailURL || tanuki.photoURL || '';

  // 評価表示
  const rating = tanukiRatings[tanuki.id];
  const ratingText = rating && rating.count > 0
    ? `⭐ ${rating.avg.toFixed(1)} (${rating.count})`
    : '⭐ -';

  // 都道府県表示
  const prefectureText = tanuki.prefecture || '未設定';

  card.innerHTML = `
    ${thumbnailURL ? `<img src="${thumbnailURL}" alt="たぬきの写真" class="card-image">` : '<div class="card-image-placeholder">🦝</div>'}
    <div class="card-content">
      <p class="card-episode">${episodePreview}</p>
      <div class="card-meta">
        <span>📍 ${prefectureText}</span>
        <span>${ratingText}</span>
      </div>
      <div class="card-meta">
        <span>📅 ${tanuki.discoveryDate ? formatDate(tanuki.discoveryDate) : '不明'}</span>
        <span>👤 ${tanuki.userName}</span>
      </div>
      ${tanuki.noteURL ? '<span class="note-badge">📝 note記事あり</span>' : ''}
    </div>
  `;

  return card;
}
