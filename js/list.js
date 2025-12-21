// リストビュー機能

// グローバル変数
let allTanukis = [];
let tanukiRatings = {}; // tanukiId -> { avg, count }
let isListAdmin = false; // 管理者フラグ

// 都道府県の地域順マッピング（北から南へ）
const PREFECTURE_ORDER = {
  // 北海道
  '北海道': 1,
  // 東北
  '青森県': 2, '岩手県': 3, '宮城県': 4, '秋田県': 5, '山形県': 6, '福島県': 7,
  // 関東
  '茨城県': 8, '栃木県': 9, '群馬県': 10, '埼玉県': 11, '千葉県': 12, '東京都': 13, '神奈川県': 14,
  // 甲信越
  '新潟県': 15, '山梨県': 16, '長野県': 17,
  // 北陸
  '富山県': 18, '石川県': 19, '福井県': 20,
  // 東海
  '岐阜県': 21, '静岡県': 22, '愛知県': 23, '三重県': 24,
  // 関西
  '滋賀県': 25, '京都府': 26, '大阪府': 27, '兵庫県': 28, '奈良県': 29, '和歌山県': 30,
  // 中国
  '鳥取県': 31, '島根県': 32, '岡山県': 33, '広島県': 34, '山口県': 35,
  // 四国
  '徳島県': 36, '香川県': 37, '愛媛県': 38, '高知県': 39,
  // 九州・沖縄
  '福岡県': 40, '佐賀県': 41, '長崎県': 42, '熊本県': 43, '大分県': 44, '宮崎県': 45, '鹿児島県': 46, '沖縄県': 47,
  // 海外・不明は最後
  '不明': 99
};

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

  // 認証状態の監視（管理者判定）
  firebase.auth().onAuthStateChanged((user) => {
    if (user && ADMIN_EMAILS.includes(user.email)) {
      isListAdmin = true;
      // 既にリストが表示されていれば再描画
      if (allTanukis.length > 0) {
        sortAndDisplayTanukis(document.getElementById('sortSelect').value);
      }
    } else {
      isListAdmin = false;
    }
  });

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

    // orderByをクライアント側で行うことでインデックス不要に
    const snapshot = await db.collection('tanukis')
      .where('status', '==', 'active')
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
    const seenIds = new Set();
    snapshot.forEach((doc) => {
      const tanuki = doc.data();
      tanuki.id = doc.id;

      // 重複チェック
      if (seenIds.has(doc.id)) {
        console.warn('重複ID検出:', doc.id);
        return;
      }
      seenIds.add(doc.id);

      console.log('tanuki:', tanuki.id, 'isShop:', tanuki.isShop, 'episode:', tanuki.episode.substring(0, 30));
      allTanukis.push(tanuki);
    });

    console.log('取得件数:', allTanukis.length, 'ユニークID数:', seenIds.size);
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
      // 都道府県別（地域順：北から南へ）
      sorted.sort((a, b) => {
        const prefA = a.prefecture || '不明';
        const prefB = b.prefecture || '不明';
        const orderA = PREFECTURE_ORDER[prefA] || 98; // 海外など未定義は98
        const orderB = PREFECTURE_ORDER[prefB] || 98;
        return orderA - orderB;
      });
      break;

    case 'rating':
      // 評価順（高い順、同評価なら評価数が多い順、未評価は最後）
      sorted.sort((a, b) => {
        const ratingA = tanukiRatings[a.id] || { avg: 0, count: 0 };
        const ratingB = tanukiRatings[b.id] || { avg: 0, count: 0 };
        // まず評価で比較、同じなら評価数で比較
        if (ratingB.avg !== ratingA.avg) {
          return ratingB.avg - ratingA.avg;
        }
        return ratingB.count - ratingA.count;
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

// たぬきリスト行を作成（シンプル版）
function createTanukiCard(tanuki) {
  const row = document.createElement('div');
  row.className = 'tanuki-row';

  // クリックで詳細ページに遷移
  row.onclick = () => {
    window.location.href = `detail.html?id=${tanuki.id}&from=list`;
  };

  // エピソードのプレビュー(最初の50文字)
  const episodePreview = tanuki.episode.length > 50
    ? tanuki.episode.substring(0, 50) + '...'
    : tanuki.episode;

  // 評価表示
  const rating = tanukiRatings[tanuki.id];
  const ratingText = rating && rating.count > 0
    ? `${rating.avg.toFixed(1)} (${rating.count})`
    : '-';

  // 都道府県表示
  const prefectureText = tanuki.prefecture || '未設定';

  // 削除ボタン（管理者のみ）
  const deleteBtn = isListAdmin
    ? `<button class="row-delete" onclick="deleteTanuki('${tanuki.id}', event)">🗑</button>`
    : '';

  row.innerHTML = `
    <span class="row-shop">${tanuki.isShop ? '🛒' : ''}</span>
    <span class="row-prefecture">📍 ${prefectureText}</span>
    <span class="row-rating">⭐ ${ratingText}</span>
    <span class="row-episode">${episodePreview}</span>
    ${deleteBtn}
  `;

  return row;
}

// たぬきを削除（管理者用）
async function deleteTanuki(id, event) {
  event.stopPropagation(); // 行クリックを防止
  if (!confirm('このたぬきを削除しますか？')) return;

  try {
    await db.collection('tanukis').doc(id).update({ status: 'deleted' });
    // リストから削除
    allTanukis = allTanukis.filter(t => t.id !== id);
    // カウント更新
    document.getElementById('tanukiCount').textContent = `${allTanukis.length}件のたぬき`;
    // 再描画
    sortAndDisplayTanukis(document.getElementById('sortSelect').value);
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました');
  }
}
