// 地図機能

let map;
let markers = [];
let cluster = null; // マーカークラスタ
let currentInfoWindow = null;
let selectedLocation = null;
let tempMarker = null; // 仮マーカー
let longPressTimer = null; // 長押し用タイマー

// 新規たぬき通知用
const LAST_VISIT_KEY = 'tanukiMap_lastVisit';
let newTanukisList = [];
let currentNewTanukiIndex = 0;

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

  // URLパラメータから座標を取得（詳細ページから戻った場合）
  const urlLat = parseFloat(getUrlParameter('lat'));
  const urlLng = parseFloat(getUrlParameter('lng'));

  if (!isNaN(urlLat) && !isNaN(urlLng)) {
    // URLパラメータがある場合はその位置にセンタリング
    map.setCenter({ lat: urlLat, lng: urlLng });
    map.setZoom(DEFAULT_MAP_ZOOM);
  } else if (navigator.geolocation) {
    // URLパラメータがない場合は現在地を取得
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
    let currentTouchCount = 0; // 現在の指の本数を追跡
    let wasCancelled = false; // ピンチ等でキャンセルされたかどうか

    // タイマーをキャンセルする共通関数
    function cancelLongPress() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      touchStartX = null;
      touchStartY = null;
      wasCancelled = true;
    }

    mapDiv.addEventListener('touchstart', (e) => {
      currentTouchCount = e.touches.length;
      wasCancelled = false;

      if (!currentUser) return;

      // 2本指以上の場合はキャンセル（ピンチズーム対策）
      if (currentTouchCount !== 1) {
        cancelLongPress();
        return;
      }

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      longPressTimer = setTimeout(() => {
        // タイマー発火時にキャンセル状態と指の本数を確認
        if (wasCancelled) return;
        if (touchStartX === null || touchStartY === null) return;
        if (currentTouchCount !== 1) return;

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
      }, 800); // 長押し判定を800msに延長（ピンチ操作との誤認防止）
    }, { passive: true });

    mapDiv.addEventListener('touchend', (e) => {
      currentTouchCount = e.touches.length;
      cancelLongPress();
    }, { passive: true });

    mapDiv.addEventListener('touchmove', (e) => {
      currentTouchCount = e.touches.length;

      if (longPressTimer) {
        // 2本指になったらキャンセル（ピンチズーム対策）
        if (currentTouchCount !== 1) {
          cancelLongPress();
          return;
        }

        // 10px以上移動したらキャンセル（スワイプ対策）
        if (touchStartX !== null && touchStartY !== null) {
          const touch = e.touches[0];
          const dx = Math.abs(touch.clientX - touchStartX);
          const dy = Math.abs(touch.clientY - touchStartY);
          if (dx > 10 || dy > 10) {
            cancelLongPress();
          }
        }
      }
    }, { passive: true });

    // マップのドラッグ・ズーム開始でもキャンセル
    map.addListener('dragstart', cancelLongPress);
    map.addListener('zoom_changed', cancelLongPress);

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

    // 前回訪問時刻を取得（エラー対策付き）
    let lastVisitTime = null;
    try {
      const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
      console.log('前回訪問時刻:', lastVisit);
      lastVisitTime = lastVisit ? new Date(lastVisit) : null;
      // 現在時刻を保存（次回用）
      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString());
    } catch (e) {
      console.warn('localStorage unavailable:', e);
    }

    const snapshot = await db.collection('tanukis')
      .where('status', '==', 'active')
      .get();

    // 既存のマーカーとクラスタを削除
    if (cluster) {
      cluster.clearMarkers();
      cluster = null;
    }
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // 新規投稿を検出
    newTanukisList = [];

    // 各たぬきのマーカーを追加
    snapshot.forEach((doc) => {
      const tanuki = doc.data();
      tanuki.id = doc.id;
      addMarker(tanuki);

      // 新規投稿チェック（前回訪問時刻以降に作成されたもの）
      if (lastVisitTime && tanuki.createdAt?.toDate() > lastVisitTime) {
        newTanukisList.push(tanuki);
      }
    });

    // 新規投稿を新しい順にソート
    newTanukisList.sort((a, b) => {
      const dateA = a.createdAt?.toDate() || new Date(0);
      const dateB = b.createdAt?.toDate() || new Date(0);
      return dateB - dateA;
    });

    // マーカークラスタを作成
    if (markers.length > 0 && window.markerClusterer) {
      cluster = new window.markerClusterer.MarkerClusterer({
        map,
        markers,
        renderer: {
          render: ({ count, position }) => {
            // たぬきアイコンのサイズ（数が多いほど大きく）
            const size = Math.min(32 + count * 2, 48);
            return new google.maps.Marker({
              position,
              icon: {
                url: 'img/tanuki-marker.png',
                scaledSize: new google.maps.Size(size, size),
                anchor: new google.maps.Point(size / 2, size)
              },
              label: {
                text: String(count),
                color: '#8B4513',
                fontWeight: 'bold',
                fontSize: '11px',
                className: 'cluster-label'
              },
              zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
            });
          }
        }
      });
    }

    hideLoading();
    console.log(`${snapshot.size}個のたぬきを読み込みました`);
    console.log('新規たぬき件数:', newTanukisList.length);

    // 新規投稿があれば通知を表示
    if (newTanukisList.length > 0) {
      console.log('通知を表示します');
      currentNewTanukiIndex = 0;
      showNewTanukiNotification();
    } else {
      console.log('新規たぬきなし（前回訪問以降の投稿がない）');
    }

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

  // ショップかどうかでマーカーアイコンを切り替え
  const isShop = tanuki.isShop;
  const iconUrl = isShop
    ? 'img/tanuki-shop-marker.png?v=2'
    : 'img/tanuki-marker.png';
  const iconSize = isShop ? 32 : 24;

  // カスタムアイコン(信楽焼の狸)
  const marker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: map,
    icon: {
      url: iconUrl,
      scaledSize: new google.maps.Size(iconSize, iconSize),
      anchor: new google.maps.Point(iconSize / 2, iconSize)
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

  const shopBadge = tanuki.isShop ? '<p><span style="background: #4CAF50; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.8em;">🛒 購入可</span></p>' : '';

  return `
    <div class="tanuki-popup">
      <h3>🦝 ${tanuki.episode.substring(0, 50)}${tanuki.episode.length > 50 ? '...' : ''}</h3>
      ${shopBadge}
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

// ========== 新規たぬき通知機能 ==========

// 通知バナーを表示
function showNewTanukiNotification() {
  // 既存の通知があれば削除
  hideNewTanukiNotification();

  const tanuki = newTanukisList[currentNewTanukiIndex];
  if (!tanuki) return;

  const total = newTanukisList.length;
  const current = currentNewTanukiIndex + 1;
  const episodePreview = tanuki.episode.length > 30
    ? tanuki.episode.substring(0, 30) + '...'
    : tanuki.episode;

  const notification = document.createElement('div');
  notification.id = 'newTanukiNotification';
  notification.className = 'new-tanuki-notification';
  notification.innerHTML = `
    <div class="notification-header">
      <span>新しいたぬきが${total}件投稿されました！</span>
      <button class="notification-close" onclick="hideNewTanukiNotification()">×</button>
    </div>
    <div class="notification-content">
      <span class="notification-counter">(${current}/${total})</span>
      <span class="notification-episode">${episodePreview}</span>
    </div>
    <div class="notification-actions">
      <button class="btn-secondary notification-btn" onclick="navigateToPrevNewTanuki()" ${current === 1 ? 'disabled' : ''}>← 前へ</button>
      <button class="btn-secondary notification-btn" onclick="navigateToNextNewTanuki()" ${current === total ? 'disabled' : ''}>次へ →</button>
    </div>
  `;

  document.body.appendChild(notification);

  // 最初のたぬきの位置にマップを移動
  navigateToNewTanuki(currentNewTanukiIndex);
}

// 通知バナーを非表示
function hideNewTanukiNotification() {
  const notification = document.getElementById('newTanukiNotification');
  if (notification) {
    notification.remove();
  }
}

// 指定インデックスのたぬきにマップを移動
function navigateToNewTanuki(index) {
  const tanuki = newTanukisList[index];
  if (!tanuki || !tanuki.location) return;

  const { latitude, longitude } = tanuki.location;
  map.setCenter({ lat: latitude, lng: longitude });
  map.setZoom(16);

  // マーカーを見つけてInfoWindowを開く
  const marker = markers.find(m => {
    const pos = m.getPosition();
    return Math.abs(pos.lat() - latitude) < 0.0001 &&
           Math.abs(pos.lng() - longitude) < 0.0001;
  });

  if (marker) {
    google.maps.event.trigger(marker, 'click');
  }
}

// 前のたぬきへ
function navigateToPrevNewTanuki() {
  if (currentNewTanukiIndex > 0) {
    currentNewTanukiIndex--;
    showNewTanukiNotification();
  }
}

// 次のたぬきへ
function navigateToNextNewTanuki() {
  if (currentNewTanukiIndex < newTanukisList.length - 1) {
    currentNewTanukiIndex++;
    showNewTanukiNotification();
  }
}
