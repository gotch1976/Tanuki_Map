// 地図機能

let map;
let markers = [];
let currentInfoWindow = null;
let selectedLocation = null;
let tempMarker = null; // 仮マーカー
let longPressTimer = null; // 長押し用タイマー

// 地図の初期化
function initMap() {
  console.log('initMap() 開始');
  const mapElement = document.getElementById('map');
  console.log('地図要素:', mapElement);

  if (!mapElement) {
    console.error('地図要素が見つかりません');
    return;
  }

  // 地図を作成
  try {
    map = new google.maps.Map(mapElement, {
      center: {
        lat: DEFAULT_MAP_CENTER.lat,
        lng: DEFAULT_MAP_CENTER.lng
      },
      zoom: DEFAULT_MAP_ZOOM
    });
    console.log('地図作成成功:', map);
  } catch (error) {
    console.error('地図作成エラー:', error);
    return;
  }

  // 現在地を取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setCenter({ lat, lng });
        map.setZoom(DEFAULT_MAP_ZOOM);

        // 現在地にマーカーを表示(オプション)
        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: map,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          }
        });

        const infoWindow = new google.maps.InfoWindow({
          content: '📍 現在地'
        });
        infoWindow.open(map, marker);
      },
      (error) => {
        console.log('現在地取得エラー:', error);
      }
    );
  }

  // 位置選択時の共通処理
  function handleLocationSelect(lat, lng) {
    if (!currentUser) return;

    selectedLocation = { lat, lng };
    console.log('選択した位置:', selectedLocation);

    // 既存の仮マーカーを削除
    if (tempMarker) {
      tempMarker.setMap(null);
    }

    // 仮マーカーを表示（茶色のピン型）
    tempMarker = new google.maps.Marker({
      position: { lat, lng },
      map: map,
      icon: {
        path: 'M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z',
        fillColor: '#8B4513',
        fillOpacity: 1,
        strokeColor: '#5D2E0C',
        strokeWeight: 2,
        scale: 1.2,
        anchor: new google.maps.Point(0, 0)
      },
      animation: google.maps.Animation.DROP
    });

    // ポップアップで確認
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="text-align: center; padding: 5px;">
          <p style="margin: 0 0 10px 0;">📍 ここにたぬきを追加しますか？</p>
          <button onclick="openModal()" style="
            background-color: #8B4513;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">追加する</button>
        </div>
      `
    });
    infoWindow.open(map, tempMarker);
  }

  // タッチデバイス判定
  const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const mapDiv = document.getElementById('map');

  if (hasTouchScreen) {
    // モバイル: 長押しで位置選択（clickイベントは使わない）
    let touchStartX = null;
    let touchStartY = null;

    mapDiv.addEventListener('touchstart', (e) => {
      if (!currentUser) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      longPressTimer = setTimeout(() => {
        if (touchStartX === null || touchStartY === null) return;

        const rect = mapDiv.getBoundingClientRect();
        const x = touchStartX - rect.left;
        const y = touchStartY - rect.top;

        const bounds = map.getBounds();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const lat = ne.lat() - (y / rect.height) * (ne.lat() - sw.lat());
        const lng = sw.lng() + (x / rect.width) * (ne.lng() - sw.lng());

        handleLocationSelect(lat, lng);
      }, 500);
    }, { passive: true });

    mapDiv.addEventListener('touchend', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      touchStartX = null;
      touchStartY = null;
    }, { passive: true });

    mapDiv.addEventListener('touchmove', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

  } else {
    // PC: クリックで位置選択
    map.addListener('click', (e) => {
      handleLocationSelect(e.latLng.lat(), e.latLng.lng());
    });
  }

  // リストビューボタン
  const listViewBtn = document.getElementById('listViewBtn');
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      window.location.href = 'list.html';
    });
  }

  // リロードボタン
  const reloadBtn = document.getElementById('reloadBtn');
  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => {
      loadTanukis();
      showSuccess('マップを更新しました');
    });
  }

  // たぬきを読み込み
  loadTanukis();
}

// たぬきをFirestoreから読み込み
async function loadTanukis() {
  try {
    showLoading('たぬきを読み込み中...');

    const snapshot = await db.collection('tanukis')
      .where('status', '==', 'active')
      .get();

    // 既存のマーカーを削除
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // 各たぬきのマーカーを追加
    snapshot.forEach((doc) => {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      addMarker(tanuki);
    });

    hideLoading();
    console.log(`${snapshot.size}個のたぬきを読み込みました`);

  } catch (error) {
    hideLoading();
    console.error('たぬき読み込みエラー:', error);
    showError('たぬきの読み込みに失敗しました');
  }
}

// マーカーを地図に追加（N+1クエリ修正版：評価はクリック時に遅延読み込み）
function addMarker(tanuki) {
  if (!tanuki.location) return;

  const { latitude, longitude } = tanuki.location;

  // カスタムアイコン(信楽焼の狸)
  const marker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: map,
    icon: {
      url: 'img/tanuki-marker.png',
      scaledSize: new google.maps.Size(32, 32),
      anchor: new google.maps.Point(16, 32)
    }
  });

  // 初期ポップアップ（評価は後で読み込み）
  const infoWindow = new google.maps.InfoWindow({
    content: createPopupContent(tanuki, '読み込み中...', 0),
    maxWidth: 300
  });

  // 評価キャッシュ
  let ratingLoaded = false;

  marker.addListener('click', async () => {
    if (currentInfoWindow) {
      currentInfoWindow.close();
    }
    infoWindow.open(map, marker);
    currentInfoWindow = infoWindow;

    // 評価を遅延読み込み（1回だけ）
    if (!ratingLoaded) {
      try {
        const ratingsSnapshot = await db.collection('tanukis')
          .doc(tanuki.id).collection('ratings').get();

        let avgRating = '-';
        let ratingCount = 0;

        if (ratingsSnapshot.size > 0) {
          let total = 0;
          ratingsSnapshot.forEach(doc => total += doc.data().rating);
          avgRating = (total / ratingsSnapshot.size).toFixed(1);
          ratingCount = ratingsSnapshot.size;
        }

        // ポップアップ内容を更新
        infoWindow.setContent(createPopupContent(tanuki, avgRating, ratingCount));
        ratingLoaded = true;
      } catch (e) {
        console.log('評価取得エラー:', e);
        infoWindow.setContent(createPopupContent(tanuki, '-', 0));
      }
    }
  });

  markers.push(marker);
}

// ポップアップのHTML生成
function createPopupContent(tanuki, avgRating, ratingCount) {
  const ratingText = avgRating === '読み込み中...'
    ? '⭐ 読み込み中...'
    : (avgRating !== '-' ? `⭐ ${avgRating} (${ratingCount}件)` : '⭐ 未評価');

  return `
    <div class="tanuki-popup">
      <h3>🦝 ${tanuki.episode.substring(0, 50)}${tanuki.episode.length > 50 ? '...' : ''}</h3>
      <p><strong>評価:</strong> ${ratingText}</p>
      <p><strong>投稿者:</strong> ${tanuki.userName}</p>
      <p><strong>発見日:</strong> ${tanuki.discoveryDate ? formatDate(tanuki.discoveryDate) : '不明'}</p>
      <a href="detail.html?id=${tanuki.id}" class="btn-primary" style="display: inline-block; margin-top: 10px;">詳細を見る</a>
    </div>
  `;
}

// Google Maps APIのコールバック関数（グローバルに定義）
window.initializeApp = function() {
  console.log('Google Maps APIコールバック実行');

  // Firebase初期化
  if (!initFirebase()) {
    showError('Firebaseの初期化に失敗しました。js/config.jsの設定を確認してください。');
    return;
  }

  setupFirestore();

  // 認証初期化
  initAuth();

  // 地図初期化
  initMap();

  // たぬき追加機能初期化
  initAddTanuki();

  // 編集モードチェック（詳細ページからの遷移）
  const editId = getUrlParameter('edit');
  if (editId) {
    loadTanukiForEdit(editId);
  }
};

// 編集用にたぬきデータを読み込み
async function loadTanukiForEdit(tanukiId) {
  try {
    showLoading('読み込み中...');
    const doc = await db.collection('tanukis').doc(tanukiId).get();
    hideLoading();

    if (doc.exists) {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      openModal(tanuki);
    } else {
      showError('たぬきが見つかりません');
    }
  } catch (error) {
    hideLoading();
    console.error('編集データ読み込みエラー:', error);
    showError('データの読み込みに失敗しました');
  }
}
