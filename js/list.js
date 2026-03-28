// リストビュー機能

// グローバル変数
let allTanukis = [];
let tanukiRatings = {}; // tanukiId -> { avg, count }
let userRatedTanukis = new Set(); // ユーザーが評価済みのたぬきID
let isListAdmin = false; // 管理者フラグ

// ページネーション設定
const ITEMS_PER_PAGE = 100;
let currentPage = 1;
let sortedTanukis = []; // ソート済みデータ（ページング用）
let ratingsLoaded = false; // 評価読み込み済みフラグ

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
    ratingsLoaded = true;

    // 初期表示（日付順）
    currentPage = 1;
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
  const currentUserId = firebase.auth().currentUser?.uid;

  const promises = allTanukis.map(async (tanuki) => {
    try {
      const ratingsSnapshot = await db.collection('tanukis')
        .doc(tanuki.id).collection('ratings').get();

      if (ratingsSnapshot.size > 0) {
        let total = 0;
        ratingsSnapshot.forEach(doc => {
          total += doc.data().rating;
          // ユーザーが評価済みかチェック
          if (currentUserId && doc.id === currentUserId) {
            userRatedTanukis.add(tanuki.id);
          }
        });
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
async function sortAndDisplayTanukis(sortType) {
  // 評価順・未評価順の場合、評価データが必要
  if ((sortType === 'rating' || sortType === 'unrated') && !ratingsLoaded) {
    showLoading('評価データを読み込み中...');
    await loadAllRatings();
    ratingsLoaded = true;
    hideLoading();
  }

  sortedTanukis = [...allTanukis];

  switch (sortType) {
    case 'date':
      // 日付順（新しい順）
      sortedTanukis.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      break;

    case 'prefecture':
      // 都道府県別（地域順：北から南へ）
      sortedTanukis.sort((a, b) => {
        const prefA = a.prefecture || '不明';
        const prefB = b.prefecture || '不明';
        const orderA = PREFECTURE_ORDER[prefA] || 98; // 海外など未定義は98
        const orderB = PREFECTURE_ORDER[prefB] || 98;
        return orderA - orderB;
      });
      break;

    case 'rating':
      // 評価順（高い順、同評価なら評価数が多い順、未評価は最後）
      sortedTanukis.sort((a, b) => {
        const ratingA = tanukiRatings[a.id] || { avg: 0, count: 0 };
        const ratingB = tanukiRatings[b.id] || { avg: 0, count: 0 };
        // まず評価で比較、同じなら評価数で比較
        if (ratingB.avg !== ratingA.avg) {
          return ratingB.avg - ratingA.avg;
        }
        return ratingB.count - ratingA.count;
      });
      break;

    case 'unrated':
      // 未評価順（自分が未評価のものを先に、古い順）
      sortedTanukis.sort((a, b) => {
        const aRated = userRatedTanukis.has(a.id);
        const bRated = userRatedTanukis.has(b.id);
        // 未評価を先に
        if (aRated !== bRated) {
          return aRated ? 1 : -1;
        }
        // 同じ評価状態なら古い順
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateA - dateB;
      });
      break;
  }

  // ソート変更時は1ページ目に戻る
  currentPage = 1;
  displayCurrentPage();
}

// 現在のページを表示
function displayCurrentPage() {
  const tanukiList = document.getElementById('tanukiList');
  const totalPages = Math.ceil(sortedTanukis.length / ITEMS_PER_PAGE);

  // ページ範囲を計算
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sortedTanukis.length);
  const pageItems = sortedTanukis.slice(startIndex, endIndex);

  // リストを描画
  tanukiList.innerHTML = '';
  pageItems.forEach(tanuki => {
    tanukiList.appendChild(createTanukiCard(tanuki));
  });

  // ページネーションUIを更新
  updatePaginationUI(totalPages, startIndex + 1, endIndex);
}

// ページネーションUIを更新
function updatePaginationUI(totalPages, startItem, endItem) {
  let paginationEl = document.getElementById('pagination');

  // ページネーション要素がなければ作成
  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'pagination';
    paginationEl.className = 'pagination';
    document.getElementById('tanukiList').after(paginationEl);
  }

  // 1ページしかない場合は非表示
  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';
  paginationEl.innerHTML = `
    <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      ← 前へ
    </button>
    <span class="pagination-info">
      ${startItem}-${endItem} / ${sortedTanukis.length}件（${currentPage}/${totalPages}ページ）
    </span>
    <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      次へ →
    </button>
  `;
}

// 指定ページに移動
function goToPage(page) {
  const totalPages = Math.ceil(sortedTanukis.length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;

  currentPage = page;
  displayCurrentPage();

  // ページ上部にスクロール
  document.querySelector('.list-container')?.scrollIntoView({ behavior: 'smooth' });
}

// たぬきリスト行を作成（シンプル版）
function createTanukiCard(tanuki) {
  const row = document.createElement('div');
  row.className = 'tanuki-row';

  // クリックで詳細ページに遷移（ソート済みIDリストをsessionStorageに保存）
  row.onclick = () => {
    const idList = sortedTanukis.map(t => t.id);
    sessionStorage.setItem('tanukiList', JSON.stringify(idList));
    window.location.href = `detail.html?id=${tanuki.id}&from=list`;
  };

  // エピソードのプレビュー(最初の50文字)
  const episodePreview = tanuki.episode.length > 50
    ? tanuki.episode.substring(0, 50) + '...'
    : tanuki.episode;

  // 評価表示（評価順ソート時のみ評価を表示）
  const rating = tanukiRatings[tanuki.id];
  const ratingText = rating && rating.count > 0
    ? `${rating.avg.toFixed(1)} (${rating.count})`
    : '-';

  // 評価済みチェック（評価読み込み済みの場合のみ）
  const isRated = ratingsLoaded && userRatedTanukis.has(tanuki.id);
  const ratedMark = isRated ? '<span class="rated-check">✓</span>' : '<span class="rated-check"></span>';

  // 都道府県表示
  const prefectureText = tanuki.prefecture || '未設定';

  // 削除ボタン（管理者のみ）
  const deleteBtn = isListAdmin
    ? `<button class="row-delete" onclick="deleteTanuki('${tanuki.id}', event)">🗑</button>`
    : '';

  row.innerHTML = `
    <span class="row-shop">${tanuki.isShop ? '🛒' : ''}</span>
    <span class="row-prefecture">📍 ${prefectureText}</span>
    <span class="row-rating">${ratedMark} ⭐ ${ratingText}</span>
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
