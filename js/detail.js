// 詳細ページ機能

let currentTanuki = null;
let miniMap = null;
let userHasRated = false;
let selectedRating = 0; // 選択中の評価（未確定）

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

  // URLからたぬきIDを取得
  const tanukiId = getUrlParameter('id');
  if (!tanukiId) {
    showError('たぬきIDが指定されていません');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 2000);
    return;
  }

  // たぬきデータを読み込み
  await loadTanukiDetail(tanukiId);

  // イベントリスナー
  setupEventListeners();
});

// イベントリスナー設定
function setupEventListeners() {
  // 戻るボタン（マップを再読み込みするためindex.htmlに直接遷移、たぬきの位置を保持）
  document.getElementById('backBtn')?.addEventListener('click', () => {
    if (currentTanuki && currentTanuki.location) {
      const { latitude, longitude } = currentTanuki.location;
      window.location.href = `index.html?lat=${latitude}&lng=${longitude}`;
    } else {
      window.location.href = 'index.html';
    }
  });

  // 編集ボタン
  document.getElementById('editBtn')?.addEventListener('click', () => {
    // index.htmlに戻って編集モーダルを開く
    window.location.href = `index.html?edit=${currentTanuki.id}`;
  });

  // 削除ボタン
  document.getElementById('deleteBtn')?.addEventListener('click', deleteTanuki);
}

// たぬき詳細を読み込み
async function loadTanukiDetail(tanukiId) {
  try {
    showLoading('読み込み中...');

    const doc = await db.collection('tanukis').doc(tanukiId).get();

    if (!doc.exists) {
      hideLoading();
      showError('たぬきが見つかりません');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
      return;
    }

    currentTanuki = doc.data();
    currentTanuki.id = doc.id;

    displayTanukiDetail(currentTanuki);
    updateActionButtons(currentTanuki);

    hideLoading();

  } catch (error) {
    hideLoading();
    console.error('読み込みエラー:', error);
    showError('たぬきの読み込みに失敗しました');
  }
}

// たぬき詳細を表示
function displayTanukiDetail(tanuki) {
  // 写真(写真なし版では要素が存在しないのでスキップ)
  const tanukiPhoto = document.getElementById('tanukiPhoto');
  if (tanukiPhoto) {
    tanukiPhoto.src = tanuki.photoURL || '';
  }

  // エピソード
  document.getElementById('episode').textContent = tanuki.episode || '';

  // 場所
  if (tanuki.location) {
    const { latitude, longitude } = tanuki.location;
    document.getElementById('location').textContent =
      `緯度: ${latitude.toFixed(6)}, 経度: ${longitude.toFixed(6)}`;

    // ミニマップ表示
    initMiniMap(latitude, longitude);
  }

  // 特徴
  if (tanuki.characteristics) {
    document.getElementById('characteristics').textContent = tanuki.characteristics;
  }

  // 発見日
  if (tanuki.discoveryDate) {
    document.getElementById('discoveryDate').textContent = formatDate(tanuki.discoveryDate);
  }

  // 投稿者
  document.getElementById('poster').textContent = tanuki.userName || '不明';

  // note記事リンク
  if (tanuki.noteURL) {
    const noteSection = document.getElementById('noteSection');
    const noteLink = document.getElementById('noteLink');
    noteSection.style.display = 'block';
    noteLink.href = tanuki.noteURL;
  }
}

// ミニマップを初期化
function initMiniMap(latitude, longitude) {
  const mapDiv = document.getElementById('miniMap');
  if (!mapDiv) return;

  miniMap = new google.maps.Map(document.getElementById('miniMap'), {
    center: { lat: latitude, lng: longitude },
    zoom: 15
  });

  // マーカーを追加
  const marker = new google.maps.Marker({
    position: { lat: latitude, lng: longitude },
    map: miniMap,
    icon: {
      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
    }
  });

  const infoWindow = new google.maps.InfoWindow({
    content: '🦝 たぬきの場所'
  });
  infoWindow.open(miniMap, marker);
}

// アクションボタンの表示制御
function updateActionButtons(tanuki) {
  auth.onAuthStateChanged(async (user) => {
    const editBtn = document.getElementById('editBtn');
    const deleteBtn = document.getElementById('deleteBtn');

    if (user && canEdit(tanuki.userId)) {
      if (editBtn) editBtn.style.display = 'inline-block';
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
      if (editBtn) editBtn.style.display = 'none';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    // 認証状態が確定してから評価とコメントを読み込み
    await loadRatings(tanuki.id);
    await loadComments(tanuki.id);
    updateCommentUI();
  });
}

// 評価を読み込み
async function loadRatings(tanukiId) {
  try {
    const ratingsSnapshot = await db.collection('tanukis')
      .doc(tanukiId).collection('ratings').get();

    let totalRating = 0;
    let ratingCount = 0;
    let userRating = null;

    ratingsSnapshot.forEach(doc => {
      const data = doc.data();
      totalRating += data.rating;
      ratingCount++;
      if (currentUser && doc.id === currentUser.uid) {
        userRating = data.rating;
        userHasRated = true;
      }
    });

    // 平均評価を表示
    const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '-';
    document.getElementById('averageRating').textContent = `⭐ ${avgRating}`;
    document.getElementById('ratingCount').textContent = `(${ratingCount}件)`;

    // ユーザー評価エリアの表示制御
    updateUserRatingUI(userRating);

  } catch (error) {
    console.error('評価読み込みエラー:', error);
  }
}

// ユーザー評価UIを更新
function updateUserRatingUI(userRating) {
  const userRatingArea = document.getElementById('userRatingArea');
  const starRating = document.getElementById('starRating');
  const ratingMessage = document.getElementById('ratingMessage');
  const ratingActions = document.getElementById('ratingActions');
  const submitBtn = document.getElementById('submitRatingBtn');
  const changeBtn = document.getElementById('changeRatingBtn');
  const nicknameGroup = document.getElementById('ratingNicknameGroup');
  const nicknameInput = document.getElementById('ratingNicknameInput');

  if (!currentUser) {
    userRatingArea.style.display = 'none';
    return;
  }

  userRatingArea.style.display = 'block';

  // Googleユーザーはニックネーム入力不要
  if (isGoogleUser()) {
    nicknameGroup.style.display = 'none';
  } else {
    nicknameGroup.style.display = 'block';
    nicknameInput.value = getNickname();
  }

  if (userRating !== null) {
    // 評価済み
    userHasRated = true;
    selectedRating = userRating;
    starRating.classList.add('disabled');
    displayStars(userRating);
    ratingActions.style.display = 'flex';
    submitBtn.style.display = 'none';
    changeBtn.style.display = 'inline-block';
    ratingMessage.textContent = '評価済み';
    if (nicknameGroup) nicknameGroup.style.display = 'none';
    setupChangeRatingButton();
  } else {
    // 未評価
    userHasRated = false;
    selectedRating = 0;
    starRating.classList.remove('disabled');
    ratingActions.style.display = 'none';
    ratingMessage.textContent = '星をタップして評価';
    setupStarRating();
  }
}

// 星を表示
function displayStars(rating) {
  const stars = document.querySelectorAll('#starRating .star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.textContent = '★';
      star.classList.add('active');
    } else {
      star.textContent = '☆';
      star.classList.remove('active');
    }
  });
}

// 星クリックイベント設定
function setupStarRating() {
  const stars = document.querySelectorAll('#starRating .star');
  const ratingActions = document.getElementById('ratingActions');
  const submitBtn = document.getElementById('submitRatingBtn');
  const ratingMessage = document.getElementById('ratingMessage');

  stars.forEach(star => {
    // クリックで星を選択（まだ確定しない）
    star.addEventListener('click', () => {
      if (userHasRated) return;

      selectedRating = parseInt(star.dataset.value);
      displayStars(selectedRating);
      ratingActions.style.display = 'flex';
      submitBtn.style.display = 'inline-block';
      ratingMessage.textContent = `${selectedRating}点を選択中`;
    });

    // ホバー効果
    star.addEventListener('mouseenter', () => {
      if (userHasRated) return;
      const value = parseInt(star.dataset.value);
      stars.forEach((s, index) => {
        if (index < value) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });

    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hover'));
    });
  });

  // 確定ボタン
  submitBtn.addEventListener('click', async () => {
    if (selectedRating === 0) return;
    await submitRating(currentTanuki.id, selectedRating);
  });
}

// 評価変更ボタンの設定
function setupChangeRatingButton() {
  const changeBtn = document.getElementById('changeRatingBtn');
  const starRating = document.getElementById('starRating');
  const submitBtn = document.getElementById('submitRatingBtn');
  const ratingMessage = document.getElementById('ratingMessage');

  changeBtn.addEventListener('click', () => {
    // 変更モードに切り替え
    userHasRated = false;
    starRating.classList.remove('disabled');
    changeBtn.style.display = 'none';
    submitBtn.style.display = 'inline-block';
    ratingMessage.textContent = '新しい評価を選択';
    setupStarRatingForChange();
  });
}

// 変更用の星クリックイベント設定
function setupStarRatingForChange() {
  const stars = document.querySelectorAll('#starRating .star');
  const ratingMessage = document.getElementById('ratingMessage');

  stars.forEach(star => {
    const newStar = star.cloneNode(true);
    star.parentNode.replaceChild(newStar, star);
  });

  const newStars = document.querySelectorAll('#starRating .star');
  newStars.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.value);
      displayStars(selectedRating);
      ratingMessage.textContent = `${selectedRating}点を選択中`;
    });

    star.addEventListener('mouseenter', () => {
      const value = parseInt(star.dataset.value);
      newStars.forEach((s, index) => {
        if (index < value) {
          s.classList.add('hover');
        } else {
          s.classList.remove('hover');
        }
      });
    });

    star.addEventListener('mouseleave', () => {
      newStars.forEach(s => s.classList.remove('hover'));
    });
  });

  // 確定ボタン（変更用）
  const submitBtn = document.getElementById('submitRatingBtn');
  const newSubmitBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

  newSubmitBtn.addEventListener('click', async () => {
    if (selectedRating === 0) return;
    await updateRating(currentTanuki.id, selectedRating);
  });
}

// 評価を送信
async function submitRating(tanukiId, rating) {
  if (!currentUser) return;

  // 匿名ユーザーの場合はニックネームチェック
  if (isAnonymousUser()) {
    const nicknameInput = document.getElementById('ratingNicknameInput');
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      showError('ニックネームを入力してください');
      nicknameInput.focus();
      return;
    }
    setNickname(nickname);
  }

  try {
    await db.collection('tanukis').doc(tanukiId)
      .collection('ratings').doc(currentUser.uid).set({
        userId: currentUser.uid,
        userName: getDisplayName(),
        rating: rating,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    userHasRated = true;
    displayStars(rating);
    document.getElementById('starRating').classList.add('disabled');
    document.getElementById('ratingMessage').textContent = '評価しました！';
    document.getElementById('submitRatingBtn').style.display = 'none';
    document.getElementById('changeRatingBtn').style.display = 'inline-block';
    document.getElementById('ratingNicknameGroup').style.display = 'none';
    setupChangeRatingButton();

    // 評価を再読み込みして平均を更新
    await loadRatings(tanukiId);

  } catch (error) {
    console.error('評価送信エラー:', error);
    showError('評価の送信に失敗しました');
  }
}

// 評価を更新
async function updateRating(tanukiId, rating) {
  if (!currentUser) return;

  try {
    await db.collection('tanukis').doc(tanukiId)
      .collection('ratings').doc(currentUser.uid).update({
        rating: rating,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    userHasRated = true;
    displayStars(rating);
    document.getElementById('starRating').classList.add('disabled');
    document.getElementById('ratingMessage').textContent = '評価を更新しました！';
    document.getElementById('submitRatingBtn').style.display = 'none';
    document.getElementById('changeRatingBtn').style.display = 'inline-block';

    // 評価を再読み込みして平均を更新
    await loadRatings(tanukiId);

  } catch (error) {
    console.error('評価更新エラー:', error);
    showError('評価の更新に失敗しました');
  }
}

// ========== コメント機能 ==========

// コメントを読み込み
async function loadComments(tanukiId) {
  try {
    const commentsSnapshot = await db.collection('tanukis')
      .doc(tanukiId).collection('comments')
      .orderBy('createdAt', 'desc')
      .get();

    const comments = [];
    commentsSnapshot.forEach(doc => {
      comments.push({ id: doc.id, ...doc.data() });
    });

    displayComments(comments);
  } catch (error) {
    console.error('コメント読み込みエラー:', error);
  }
}

// コメントを表示
function displayComments(comments) {
  const commentsList = document.getElementById('commentsList');
  const commentCount = document.getElementById('commentCount');

  commentCount.textContent = `(${comments.length}件)`;

  if (comments.length === 0) {
    commentsList.innerHTML = '<p class="no-comments">コメントはまだありません</p>';
    return;
  }

  commentsList.innerHTML = comments.map(comment => {
    // 削除は管理者のみ
    const canDelete = isCurrentUserAdmin();
    const dateStr = comment.createdAt ? formatDate(comment.createdAt) : '';

    return `
      <div class="comment-item" data-comment-id="${comment.id}">
        <div class="comment-header">
          <span class="comment-user">${escapeHtml(comment.userName)}</span>
          <span class="comment-date">${dateStr}</span>
        </div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>
        ${canDelete ? `
          <div class="comment-actions">
            <button class="comment-delete-btn" onclick="deleteComment('${comment.id}')">削除</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// コメントUIを更新（ログイン状態に応じて表示切り替え）
function updateCommentUI() {
  const userCommentArea = document.getElementById('userCommentArea');
  const commentText = document.getElementById('commentText');
  const charCount = document.getElementById('charCount');
  const nicknameGroup = document.getElementById('nicknameGroup');
  const nicknameInput = document.getElementById('nicknameInput');

  if (currentUser) {
    userCommentArea.style.display = 'block';

    // Googleユーザーはニックネーム入力不要
    if (isGoogleUser()) {
      nicknameGroup.style.display = 'none';
    } else {
      nicknameGroup.style.display = 'block';
      nicknameInput.value = getNickname();
    }

    // 文字数カウンター
    commentText.addEventListener('input', () => {
      charCount.textContent = `${commentText.value.length}/500文字`;
    });

    // フォーム送信
    const commentForm = document.getElementById('commentForm');
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitComment();
    });
  } else {
    userCommentArea.style.display = 'none';
  }
}

// コメントを送信
async function submitComment() {
  if (!currentUser || !currentTanuki) return;

  const commentText = document.getElementById('commentText');
  const text = commentText.value.trim();

  if (!text) {
    showError('コメントを入力してください');
    return;
  }

  if (text.length > 500) {
    showError('コメントは500文字以内で入力してください');
    return;
  }

  // 匿名ユーザーの場合はニックネームチェック
  if (isAnonymousUser()) {
    const nicknameInput = document.getElementById('nicknameInput');
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      showError('ニックネームを入力してください');
      nicknameInput.focus();
      return;
    }
    setNickname(nickname);
  }

  try {
    await db.collection('tanukis').doc(currentTanuki.id)
      .collection('comments').add({
        userId: currentUser.uid,
        userName: getDisplayName(),
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    commentText.value = '';
    document.getElementById('charCount').textContent = '0/500文字';
    showSuccess('コメントを投稿しました');

    // コメント再読み込み
    await loadComments(currentTanuki.id);
  } catch (error) {
    console.error('コメント送信エラー:', error);
    showError('コメントの投稿に失敗しました');
  }
}

// コメントを削除
async function deleteComment(commentId) {
  if (!currentUser || !currentTanuki) return;

  const confirmed = confirm('このコメントを削除しますか？');
  if (!confirmed) return;

  try {
    await db.collection('tanukis').doc(currentTanuki.id)
      .collection('comments').doc(commentId).delete();

    showSuccess('コメントを削除しました');

    // コメント再読み込み
    await loadComments(currentTanuki.id);
  } catch (error) {
    console.error('コメント削除エラー:', error);
    showError('コメントの削除に失敗しました');
  }
}

// ========== たぬき削除 ==========

// たぬきを削除
async function deleteTanuki() {
  if (!currentTanuki) return;

  const confirmed = confirm('本当にこのたぬきを削除しますか?\nこの操作は取り消せません。');
  if (!confirmed) return;

  try {
    showLoading('削除中...');

    // Storageから写真を削除
    if (currentTanuki.photoURL) {
      try {
        const photoRef = storage.refFromURL(currentTanuki.photoURL);
        await photoRef.delete();
      } catch (err) {
        console.warn('写真削除エラー:', err);
      }
    }

    if (currentTanuki.photoThumbnailURL) {
      try {
        const thumbRef = storage.refFromURL(currentTanuki.photoThumbnailURL);
        await thumbRef.delete();
      } catch (err) {
        console.warn('サムネイル削除エラー:', err);
      }
    }

    // Firestoreからドキュメントを削除
    await db.collection('tanukis').doc(currentTanuki.id).delete();

    hideLoading();
    showSuccess('削除しました');

    // ホームに戻る
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1500);

  } catch (error) {
    hideLoading();
    console.error('削除エラー:', error);
    showError('削除に失敗しました: ' + error.message);
  }
}
