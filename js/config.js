// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCjz0lFhNZvhL2CNA51kjTcRVxlmBbVHAc",
  authDomain: "tanuki-map.firebaseapp.com",
  projectId: "tanuki-map",
  storageBucket: "tanuki-map.firebasestorage.app",
  messagingSenderId: "533905930072",
  appId: "1:533905930072:web:ad2ed1cd5a8f2e63fed72d",
  measurementId: "G-GQ8P03KT83"
};

// 管理者のメールアドレス
const ADMIN_EMAILS = [
  "gotchtft@gmail.com"
];

// 地図の初期位置(東京)
// 必要に応じて変更できます
const DEFAULT_MAP_CENTER = {
  lat: 35.6762,  // 緯度
  lng: 139.6503  // 経度
};

const DEFAULT_MAP_ZOOM = 13;  // ズームレベル(1-18)
