// 認証機能

let currentUser = null;

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
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateUI(user);
  });
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

  if (user) {
    // ログイン済み
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userPhoto) userPhoto.src = user.photoURL || '';
    if (userName) userName.textContent = user.displayName || 'ユーザー';
    if (addTanukiBtn) addTanukiBtn.style.display = 'block';

  } else {
    // 未ログイン
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
