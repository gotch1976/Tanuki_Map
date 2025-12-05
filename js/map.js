// 地図機能

let map;
let markers = [];
let selectedLocation = null;

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

  // 地図クリックでたぬき追加位置を設定
  map.addListener('click', (e) => {
    if (currentUser) {
      selectedLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      };
      console.log('選択した位置:', selectedLocation);
    }
  });

  // リストビューボタン
  const listViewBtn = document.getElementById('listViewBtn');
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      window.location.href = 'list.html';
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

// マーカーを地図に追加
function addMarker(tanuki) {
  if (!tanuki.location) return;

  const { latitude, longitude } = tanuki.location;

  // カスタムアイコン(たぬき)
  const marker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: map,
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
  });

  // ポップアップの内容(写真なしバージョン)
  const popupContent = `
    <div class="tanuki-popup">
      <h3>🦝 ${tanuki.episode.substring(0, 50)}${tanuki.episode.length > 50 ? '...' : ''}</h3>
      <p><strong>投稿者:</strong> ${tanuki.userName}</p>
      <p><strong>発見日:</strong> ${tanuki.discoveryDate ? formatDate(tanuki.discoveryDate) : '不明'}</p>
      <a href="detail.html?id=${tanuki.id}" class="btn-primary" style="display: inline-block; margin-top: 10px;">詳細を見る</a>
    </div>
  `;

  const infoWindow = new google.maps.InfoWindow({
    content: popupContent,
    maxWidth: 300
  });

  marker.addListener('click', () => {
    infoWindow.open(map, marker);
  });

  markers.push(marker);
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
};
