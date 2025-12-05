// 地図機能

let map;
let markers = [];
let selectedLocation = null;

// 地図の初期化
function initMap() {
  // 地図を作成
  map = L.map('map').setView(
    [DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng],
    DEFAULT_MAP_ZOOM
  );

  // OpenStreetMapのタイルを追加
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  // 現在地を取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.setView([lat, lng], DEFAULT_MAP_ZOOM);

        // 現在地にマーカーを表示(オプション)
        L.marker([lat, lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(map).bindPopup('📍 現在地');
      },
      (error) => {
        console.log('現在地取得エラー:', error);
      }
    );
  }

  // 地図クリックでたぬき追加位置を設定
  map.on('click', (e) => {
    if (currentUser) {
      selectedLocation = e.latlng;
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
    markers.forEach(marker => map.removeLayer(marker));
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
  const tanukiIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const marker = L.marker([latitude, longitude], { icon: tanukiIcon })
    .addTo(map);

  // ポップアップの内容(写真なしバージョン)
  const popupContent = `
    <div class="tanuki-popup">
      <h3>🦝 ${tanuki.episode.substring(0, 50)}${tanuki.episode.length > 50 ? '...' : ''}</h3>
      <p><strong>投稿者:</strong> ${tanuki.userName}</p>
      <p><strong>発見日:</strong> ${tanuki.discoveryDate ? formatDate(tanuki.discoveryDate) : '不明'}</p>
      <a href="detail.html?id=${tanuki.id}" class="btn-primary" style="display: inline-block; margin-top: 10px;">詳細を見る</a>
    </div>
  `;

  marker.bindPopup(popupContent, { maxWidth: 300 });
  markers.push(marker);
}

// アプリ初期化
document.addEventListener('DOMContentLoaded', () => {
  // Leafletが読み込まれているか確認
  if (typeof L === 'undefined') {
    console.error('Leafletが読み込まれていません');
    showError('地図ライブラリの読み込みに失敗しました。ページを再読み込みしてください。');
    return;
  }

  console.log('Leaflet読み込み完了');

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
});
