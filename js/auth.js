// 認証機能

let currentUser = null;
const NICKNAME_KEY = 'tanukiMap_nickname';

// 認証状態の初期化
function initAuth() {
  // ログインボタンのイベント
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', signInWithGoogle);
  }

  // ログアウトボタンのイベント
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', signOut);
  }

  // 認証状態の監視
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      // 未ログインなら匿名認証
      try {
        await auth.signInAnonymously();
        console.log('匿名ログイン成功');
      } catch (error) {
        console.error('匿名ログインエラー:', error);
      }
    } else {
      currentUser = user;
      updateUI(user);
    }
  });
}

// Googleアカウントでログイン済みか
function isGoogleUser() {
  return currentUser && !currentUser.isAnonymous;
}

// 匿名ユーザーか
function isAnonymousUser() {
  return currentUser && currentUser.isAnonymous;
}

// ニックネームを取得
function getNickname() {
  try {
    return localStorage.getItem(NICKNAME_KEY) || '';
  } catch (e) {
    return '';
  }
}

// ニックネームを保存
function setNickname(name) {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch (e) {
    console.warn('localStorage unavailable:', e);
  }
}

// 表示名を取得（Googleユーザーは本名、匿名ユーザーはニックネーム）
function getDisplayName() {
  if (isGoogleUser()) {
    return currentUser.displayName || 'ユーザー';
  }
  return getNickname() || 'ゲスト';
}

// Googleでログイン
async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    const result = await auth.signInWithPopup(provider);
    const user = result.user;

    console.log('ログイン成功:', user.displayName);
    showSuccess('ログインしました!');

  } catch (error) {
    console.error('ログインエラー:', error);
    if (error.code !== 'auth/popup-closed-by-user') {
      showError('ログインに失敗しました: ' + error.message);
    }
  }
}

// ログアウト
async function signOut() {
  try {
    await auth.signOut();
    console.log('ログアウト成功');
    showSuccess('ログアウトしました');
  } catch (error) {
    console.error('ログアウトエラー:', error);
    showError('ログアウトに失敗しました');
  }
}

// UIを更新
function updateUI(user) {
  const loginBtn = document.getElementById('loginBtn');
  const userInfo = document.getElementById('userInfo');
  const userPhoto = document.getElementById('userPhoto');
  const userName = document.getElementById('userName');
  const addTanukiBtn = document.getElementById('addTanukiBtn');

  if (user && !user.isAnonymous) {
    // Googleログイン済み
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userPhoto) userPhoto.src = user.photoURL || '';
    if (userName) userName.textContent = user.displayName || 'ユーザー';
    if (addTanukiBtn) addTanukiBtn.style.display = 'block';

  } else {
    // 匿名または未ログイン（たぬき投稿不可）
    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (addTanukiBtn) addTanukiBtn.style.display = 'none';
  }
}

// 管理者かチェック
function isAdmin(email) {
  return ADMIN_EMAILS.includes(email);
}

// 現在のユーザーが管理者か
function isCurrentUserAdmin() {
  return currentUser && isAdmin(currentUser.email);
}

// 編集権限があるかチェック
function canEdit(tanukiUserId) {
  if (!currentUser) return false;
  if (isCurrentUserAdmin()) return true;
  return currentUser.uid === tanukiUserId;
}
