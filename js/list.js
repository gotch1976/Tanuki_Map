// リストビュー機能

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

    // カードを生成
    tanukiList.innerHTML = '';
    snapshot.forEach((doc) => {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      tanukiList.appendChild(createTanukiCard(tanuki));
    });

    tanukiCount.textContent = `${snapshot.size}件のたぬき`;
    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('読み込みエラー:', error);
    showError('たぬきの読み込みに失敗しました');
  }
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

  // 写真なしバージョン
  card.innerHTML = `
    <div class="card-content" style="padding: 1.5rem;">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 1rem;">🦝</div>
      <p class="card-episode">${episodePreview}</p>
      <div class="card-meta">
        <span>📅 ${tanuki.discoveryDate ? formatDate(tanuki.discoveryDate) : '不明'}</span>
        <span>👤 ${tanuki.userName}</span>
      </div>
      ${tanuki.noteURL ? '<span class="note-badge">📝 note記事あり</span>' : ''}
    </div>
  `;

  return card;
}
