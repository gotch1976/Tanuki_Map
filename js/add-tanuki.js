// たぬき追加・編集機能

let editingTanukiId = null;
let editingTanukiData = null;
let selectedPhoto = null;
let initialRating = 0; // 投稿時の評価

// 初期化
function initAddTanuki() {
  const addBtn = document.getElementById('addTanukiBtn');
  const modal = document.getElementById('addTanukiModal');
  const closeBtn = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const form = document.getElementById('tanukiForm');
  const photoInput = document.getElementById('photoInput');
  const getCurrentLocationBtn = document.getElementById('getCurrentLocation');

  // 追加ボタンクリック
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openModal();
    });
  }

  // モーダルを閉じる
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal);
  }

  // モーダル外クリックで閉じる
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // 写真選択
  if (photoInput) {
    photoInput.addEventListener('change', handlePhotoSelect);
  }

  // 現在地取得
  if (getCurrentLocationBtn) {
    getCurrentLocationBtn.addEventListener('click', getCurrentLocation);
  }

  // フォーム送信
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }

  // 星評価の設定
  setupInitialStarRating();
}

// 投稿フォームの星評価を設定
function setupInitialStarRating() {
  const stars = document.querySelectorAll('#initialStarRating .star');
  if (!stars.length) return;

  stars.forEach(star => {
    star.addEventListener('click', () => {
      initialRating = parseInt(star.dataset.value);
      document.getElementById('initialRatingInput').value = initialRating;
      displayInitialStars(initialRating);
    });

    star.addEventListener('mouseenter', () => {
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
}

// 投稿フォームの星を表示
function displayInitialStars(rating) {
  const stars = document.querySelectorAll('#initialStarRating .star');
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

// モーダルを開く
function openModal(tanuki = null) {
  const modal = document.getElementById('addTanukiModal');
  const modalTitle = document.getElementById('modalTitle');
  const form = document.getElementById('tanukiForm');

  if (!modal) return;

  // 投稿者名入力欄
  const userNameInput = document.getElementById('userNameInput');

  // 評価UI
  const ratingGroup = document.getElementById('initialRatingGroup');

  if (tanuki) {
    // 編集モード
    modalTitle.textContent = 'たぬきを編集';
    editingTanukiId = tanuki.id;
    editingTanukiData = tanuki; // 編集中のたぬきデータを保存
    fillForm(tanuki);

    // 投稿者本人の場合のみ投稿者名を編集可能
    if (userNameInput) {
      if (currentUser && tanuki.userId === currentUser.uid) {
        userNameInput.disabled = false;
        userNameInput.value = tanuki.userName || '';
      } else {
        // 管理者が編集する場合は投稿者名を変更不可
        userNameInput.disabled = true;
        userNameInput.value = tanuki.userName || '';
      }
    }

    // 編集時は評価UIを非表示（評価は詳細ページで変更）
    if (ratingGroup) {
      ratingGroup.style.display = 'none';
    }
  } else {
    // 新規追加モード
    modalTitle.textContent = 'たぬきを追加';
    editingTanukiId = null;
    editingTanukiData = null;
    form.reset();

    // photoPreview要素が存在する場合のみクリア(写真なし版では存在しない)
    const photoPreview = document.getElementById('photoPreview');
    if (photoPreview) {
      photoPreview.innerHTML = '';
    }
    selectedPhoto = null;

    // 新規投稿時はGoogleアカウント名をデフォルトに設定
    if (userNameInput && currentUser) {
      userNameInput.disabled = false;
      userNameInput.value = currentUser.displayName || '';
    }

    // 評価をリセットして表示
    initialRating = 0;
    if (ratingGroup) {
      ratingGroup.style.display = 'block';
      document.getElementById('initialRatingInput').value = 0;
      displayInitialStars(0);
    }

    // 選択済みの位置があれば設定
    if (selectedLocation) {
      document.getElementById('latitudeInput').value = selectedLocation.lat;
      document.getElementById('longitudeInput').value = selectedLocation.lng;
      document.getElementById('locationInfo').textContent =
        `緯度: ${selectedLocation.lat.toFixed(6)}, 経度: ${selectedLocation.lng.toFixed(6)}`;
    }

    // ショップチェックボックスをリセット
    const isShopCheckbox = document.getElementById('isShopCheckbox');
    if (isShopCheckbox) {
      isShopCheckbox.checked = false;
    }
  }

  modal.style.display = 'block';
}

// モーダルを閉じる
function closeModal() {
  const modal = document.getElementById('addTanukiModal');
  if (modal) {
    modal.style.display = 'none';
  }
  editingTanukiId = null;
  selectedPhoto = null;
}

// フォームに既存データを入力(編集時)
function fillForm(tanuki) {
  document.getElementById('episodeInput').value = tanuki.episode || '';
  document.getElementById('characteristicsInput').value = tanuki.characteristics || '';
  document.getElementById('noteUrlInput').value = tanuki.noteURL || '';

  if (tanuki.discoveryDate) {
    const date = tanuki.discoveryDate.toDate();
    document.getElementById('discoveryDateInput').value = date.toISOString().split('T')[0];
  }

  if (tanuki.location) {
    document.getElementById('latitudeInput').value = tanuki.location.latitude;
    document.getElementById('longitudeInput').value = tanuki.location.longitude;
    document.getElementById('locationInfo').textContent =
      `緯度: ${tanuki.location.latitude.toFixed(6)}, 経度: ${tanuki.location.longitude.toFixed(6)}`;
  }

  // 既存写真のプレビュー
  if (tanuki.photoURL) {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${tanuki.photoURL}" alt="現在の写真" style="max-width: 200px; border-radius: 8px;">`;
  }

  // 匿名設定
  const anonymousCheckbox = document.getElementById('anonymousCheckbox');
  if (anonymousCheckbox) {
    anonymousCheckbox.checked = tanuki.isAnonymous || false;
  }

  // ショップ設定
  const isShopCheckbox = document.getElementById('isShopCheckbox');
  if (isShopCheckbox) {
    isShopCheckbox.checked = tanuki.isShop || false;
  }
}

// 写真選択時
async function handlePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  // 画像ファイルかチェック（MIMEタイプまたは拡張子で判定）
  // iPhoneのHEIC画像はfile.typeが空になることがあるため、拡張子でも判定
  const fileName = file.name.toLowerCase();
  const isImageByMime = file.type.startsWith('image/');
  const isImageByExt = /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp)$/i.test(fileName);

  if (!isImageByMime && !isImageByExt) {
    showError('対応している画像形式を選択してください');
    return;
  }

  // ファイルサイズチェック(20MB以下)
  if (file.size > 20 * 1024 * 1024) {
    showError('ファイルサイズは20MB以下にしてください');
    return;
  }

  try {
    // 大きい画像は事前に圧縮
    if (file.size > 5 * 1024 * 1024) {
      showLoading('画像を圧縮中...');
      selectedPhoto = await resizeImage(file, 1200, 1200);
      hideLoading();
    } else {
      selectedPhoto = file;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById('photoPreview');
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="max-width: 200px; border-radius: 8px; margin-top: 10px;">`;
    };
    reader.readAsDataURL(selectedPhoto);
  } catch (error) {
    hideLoading();
    console.error('画像処理エラー:', error);
    showError('画像の処理に失敗しました');
  }
}

// 現在地を取得
function getCurrentLocation() {
  if (!navigator.geolocation) {
    showError('このブラウザは位置情報に対応していません');
    return;
  }

  showLoading('現在地を取得中...');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      document.getElementById('latitudeInput').value = lat;
      document.getElementById('longitudeInput').value = lng;
      document.getElementById('locationInfo').textContent =
        `緯度: ${lat.toFixed(6)}, 経度: ${lng.toFixed(6)}`;

      // 地図も移動
      if (map) {
        map.setCenter({ lat, lng });
      }

      hideLoading();
      showSuccess('現在地を取得しました');
    },
    (error) => {
      hideLoading();
      console.error('位置情報取得エラー:', error);
      showError('現在地の取得に失敗しました');
    }
  );
}

// フォーム送信
async function handleSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    showError('ログインしてください');
    return;
  }

  // フォームデータ取得
  const episode = document.getElementById('episodeInput').value.trim();
  const characteristics = document.getElementById('characteristicsInput').value.trim();
  const noteURL = document.getElementById('noteUrlInput').value.trim();
  const discoveryDateStr = document.getElementById('discoveryDateInput').value;
  const latitude = parseFloat(document.getElementById('latitudeInput').value);
  const longitude = parseFloat(document.getElementById('longitudeInput').value);

  // バリデーション
  if (!episode) {
    showError('エピソードを入力してください');
    return;
  }

  if (!latitude || !longitude) {
    showError('位置情報を設定してください(地図をクリックするか、現在地を取得)');
    return;
  }

  if (!editingTanukiId && !selectedPhoto) {
    showError('写真を選択してください');
    return;
  }

  showLoading('保存中...');

  try {
    let tanukiData = {
      episode,
      characteristics,
      noteURL: noteURL || null,
      location: {
        latitude,
        longitude
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 発見日
    if (discoveryDateStr) {
      tanukiData.discoveryDate = firebase.firestore.Timestamp.fromDate(new Date(discoveryDateStr));
    }

    // 投稿者名の取得
    const userNameInput = document.getElementById('userNameInput');
    const inputUserName = userNameInput ? userNameInput.value.trim() : '';

    // ショップフラグの取得
    const isShopCheckbox = document.getElementById('isShopCheckbox');
    tanukiData.isShop = isShopCheckbox ? isShopCheckbox.checked : false;

    if (editingTanukiId) {
      // 編集時: 投稿者本人の場合のみuserNameを更新可能
      if (currentUser && editingTanukiData && editingTanukiData.userId === currentUser.uid) {
        tanukiData.userName = inputUserName || '匿名';
      }
      // 管理者が編集する場合はuserNameを更新しない（元の値を保持）
      await updateTanuki(editingTanukiId, tanukiData);
    } else {
      // 新規作成時
      tanukiData.userName = inputUserName || '匿名';
      tanukiData.userId = currentUser.uid;
      tanukiData.userEmail = currentUser.email;
      tanukiData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      tanukiData.status = 'active';
      tanukiData.discoveryDate = tanukiData.discoveryDate || firebase.firestore.FieldValue.serverTimestamp();

      await createTanuki(tanukiData);
    }

    hideLoading();
    closeModal();
    showSuccess('保存しました!');

    // 地図を再読み込み
    loadTanukis();

  } catch (error) {
    hideLoading();
    console.error('保存エラー:', error);
    showError('保存に失敗しました: ' + error.message);
  }
}

// 新規作成
async function createTanuki(tanukiData) {
  // 都道府県を取得（エラーでも投稿は続行）
  const prefecture = await getPrefecture(
    tanukiData.location.latitude,
    tanukiData.location.longitude
  );
  if (prefecture) {
    tanukiData.prefecture = prefecture;
  }

  // ドキュメント作成
  const docRef = await db.collection('tanukis').add(tanukiData);
  const tanukiId = docRef.id;

  // 写真アップロード
  if (selectedPhoto) {
    const { photoURL, thumbnailURL } = await uploadPhoto(tanukiId, selectedPhoto);
    await docRef.update({
      photoURL,
      photoThumbnailURL: thumbnailURL
    });
  }

  // 投稿者の評価を保存（評価が設定されている場合のみ）
  if (initialRating > 0 && currentUser) {
    await db.collection('tanukis').doc(tanukiId)
      .collection('ratings').doc(currentUser.uid).set({
        userId: currentUser.uid,
        rating: initialRating,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  }
}

// 更新
async function updateTanuki(tanukiId, tanukiData) {
  // 写真が選択されていれば新しい写真をアップロード
  if (selectedPhoto) {
    const { photoURL, thumbnailURL } = await uploadPhoto(tanukiId, selectedPhoto);
    tanukiData.photoURL = photoURL;
    tanukiData.photoThumbnailURL = thumbnailURL;
  }

  await db.collection('tanukis').doc(tanukiId).update(tanukiData);
}

// 写真をアップロード
async function uploadPhoto(tanukiId, file) {
  const storageRef = storage.ref();

  // フル画像(1200x1200にリサイズ)
  const resizedImage = await resizeImage(file, 1200, 1200);
  const imageRef = storageRef.child(`tanukis/${tanukiId}/photo.jpg`);
  await imageRef.put(resizedImage);
  const photoURL = await imageRef.getDownloadURL();

  // サムネイル(300x300にリサイズ)
  const thumbnail = await resizeImage(file, 300, 300);
  const thumbRef = storageRef.child(`tanukis/${tanukiId}/thumbnail.jpg`);
  await thumbRef.put(thumbnail);
  const thumbnailURL = await thumbRef.getDownloadURL();

  return { photoURL, thumbnailURL };
}

// 緯度経度から都道府県を取得（逆ジオコーディング）
async function getPrefecture(lat, lng) {
  try {
    const geocoder = new google.maps.Geocoder();
    const result = await geocoder.geocode({ location: { lat, lng } });

    if (result.results && result.results.length > 0) {
      // address_componentsから都道府県を抽出
      const addressComponents = result.results[0].address_components;
      const prefectureComponent = addressComponents.find(c =>
        c.types.includes('administrative_area_level_1')
      );

      if (prefectureComponent) {
        return prefectureComponent.long_name;
      }

      // 都道府県が見つからない場合は国名を返す（海外対応）
      const countryComponent = addressComponents.find(c =>
        c.types.includes('country')
      );
      if (countryComponent && countryComponent.long_name !== '日本') {
        return countryComponent.long_name;
      }
    }

    return '不明';
  } catch (error) {
    console.warn('都道府県取得エラー:', error);
    return null; // エラー時はnullを返し、投稿は続行
  }
}
