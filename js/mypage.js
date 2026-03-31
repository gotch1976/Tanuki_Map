// マイページ機能

let allTanukis = [];
let tanukiRatings = {};
let userRatedTanukis = new Set();
let currentTab = 'posted';
let sortedTanukis = [];

const ITEMS_PER_PAGE = 100;
let currentPage = 1;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  if (!initFirebase()) {
    showError('Firebaseの初期化に失敗しました');
    return;
  }

  setupFirestore();
  initAuth();

  // 戻るボタン
  document.getElementById('backBtn')?.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  // ログインボタン（マイページ内）
  document.getElementById('mypageLoginBtn')?.addEventListener('click', signInWithGoogle);

  // 認証状態を待ってからデータ読み込み
  auth.onAuthStateChanged(async (user) => {
    if (user && !user.isAnonymous) {
      document.getElementById('loginPrompt').style.display = 'none';
      document.getElementById('mypageTabs').style.display = 'flex';
      document.getElementById('mypageHeader').style.display = 'block';
      await loadAllTanukis();
      setupTabs();
      showTab('posted');
    } else {
      document.getElementById('loginPrompt').style.display = 'block';
      document.getElementById('mypageTabs').style.display = 'none';
      document.getElementById('mypageHeader').style.display = 'none';
    }
  });
});

// 全たぬきデータを読み込み
async function loadAllTanukis() {
  try {
    showLoading('読み込み中...');

    const snapshot = await db.collection('tanukis')
      .where('status', '==', 'active')
      .get();

    allTanukis = [];
    snapshot.forEach(doc => {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      allTanukis.push(tanuki);
    });

    // 評価を取得
    await loadAllRatings();

    hideLoading();
  } catch (error) {
    hideLoading();
    console.error('読み込みエラー:', error);
    showError('データの読み込みに失敗しました');
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
      tanukiRatings[tanuki.id] = { avg: 0, count: 0 };
    }
  });

  await Promise.all(promises);
}

// タブ設定
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showTab(btn.dataset.tab);
    });
  });
}

// タブ表示
function showTab(tab) {
  currentTab = tab;
  currentPage = 1;
  const userId = firebase.auth().currentUser?.uid;

  if (tab === 'posted') {
    sortedTanukis = allTanukis
      .filter(t => t.userId === userId)
      .sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
  } else if (tab === 'rated') {
    sortedTanukis = allTanukis
      .filter(t => userRatedTanukis.has(t.id))
      .sort((a, b) => {
        const ratingA = tanukiRatings[a.id] || { avg: 0 };
        const ratingB = tanukiRatings[b.id] || { avg: 0 };
        return ratingB.avg - ratingA.avg;
      });
  }

  document.getElementById('tanukiCount').textContent = `${sortedTanukis.length}件`;
  displayCurrentPage();
}

// 現在のページを表示
function displayCurrentPage() {
  const tanukiList = document.getElementById('tanukiList');
  const totalPages = Math.ceil(sortedTanukis.length / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, sortedTanukis.length);
  const pageItems = sortedTanukis.slice(startIndex, endIndex);

  if (pageItems.length === 0) {
    const message = currentTab === 'posted'
      ? 'まだ投稿がありません'
      : 'まだ評価した狸はいません';
    tanukiList.innerHTML = `<p class="no-data">${message}</p>`;
    // ページネーション非表示
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }

  tanukiList.innerHTML = '';
  pageItems.forEach(tanuki => {
    tanukiList.appendChild(createTanukiCard(tanuki));
  });

  updatePaginationUI(totalPages, startIndex + 1, endIndex);
}

// たぬきリスト行を作成
function createTanukiCard(tanuki) {
  const row = document.createElement('div');
  row.className = 'tanuki-row';

  row.onclick = () => {
    const idList = sortedTanukis.map(t => t.id);
    sessionStorage.setItem('tanukiList', JSON.stringify(idList));
    window.location.href = `detail.html?id=${tanuki.id}&from=list`;
  };

  const episodePreview = tanuki.episode.length > 50
    ? tanuki.episode.substring(0, 50) + '...'
    : tanuki.episode;

  const rating = tanukiRatings[tanuki.id];
  const ratingText = rating && rating.count > 0
    ? `${rating.avg.toFixed(1)} (${rating.count})`
    : '-';

  const prefectureText = tanuki.prefecture || '未設定';

  row.innerHTML = `
    <span class="row-shop">${tanuki.isShop ? '🛒' : ''}</span>
    <span class="row-prefecture">📍 ${prefectureText}</span>
    <span class="row-rating">⭐ ${ratingText}</span>
    <span class="row-episode">${episodePreview}</span>
  `;

  return row;
}

// ページネーションUI
function updatePaginationUI(totalPages, startItem, endItem) {
  let paginationEl = document.getElementById('pagination');

  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'pagination';
    paginationEl.className = 'pagination';
    document.getElementById('tanukiList').after(paginationEl);
  }

  if (totalPages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }

  paginationEl.style.display = 'flex';
  paginationEl.innerHTML = `
    <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
      &larr; 前へ
    </button>
    <span class="pagination-info">
      ${startItem}-${endItem} / ${sortedTanukis.length}件（${currentPage}/${totalPages}ページ）
    </span>
    <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
      次へ &rarr;
    </button>
  `;
}

function goToPage(page) {
  const totalPages = Math.ceil(sortedTanukis.length / ITEMS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  displayCurrentPage();
  document.querySelector('.list-container')?.scrollIntoView({ behavior: 'smooth' });
}
