// Firebase初期化

// Firebaseサービスの参照
let auth;
let db;
let storage;

// Firebase初期化関数
function initFirebase() {
  try {
    // Firebaseアプリを初期化
    firebase.initializeApp(firebaseConfig);

    // 各サービスの参照を取得
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();

    console.log('Firebase初期化成功');
    return true;
  } catch (error) {
    console.error('Firebase初期化エラー:', error);
    alert('Firebaseの初期化に失敗しました。設定を確認してください。');
    return false;
  }
}

// Firestore設定(オフライン対応)
function setupFirestore() {
  if (db) {
    // オフライン時のキャッシュ設定
    db.enablePersistence()
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('複数のタブが開いています。オフライン機能は1つのタブでのみ有効です。');
        } else if (err.code === 'unimplemented') {
          console.warn('このブラウザはオフライン機能に対応していません。');
        }
      });
  }
}
