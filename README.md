# 🦝 たぬきマップ (Tanuki Map)

たぬきの置物の位置をマップに登録し、写真やエピソードを共有できるWebアプリです。

## 主な機能

- 📍 地図上にたぬきの置物のピンを登録
- 📸 スマホカメラで撮影してその場で投稿
- 📖 各たぬきのエピソード・ストーリーを記録
- 🔗 note記事へのリンク機能
- 👥 複数ユーザーで投稿を共有
- 🔒 管理者権限で不適切な投稿を削除可能

## 技術スタック

- **フロントエンド**: HTML/CSS/JavaScript (フレームワークなし)
- **地図**: Leaflet (完全無料、APIキー不要)
- **バックエンド**: Firebase
  - Authentication (Googleログイン)
  - Firestore Database (データ保存)
  - Storage (写真保存)
  - Hosting (デプロイ)

## セットアップ手順

### 1. Firebaseプロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com) にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力(例: tanuki-map)
4. Google Analyticsは任意で設定

### 2. Firebase サービスの有効化

#### Authentication (認証)
1. Firebase Console → Authentication → 「始める」
2. Sign-in method タブ → Google を有効化

#### Firestore Database
1. Firebase Console → Firestore Database → 「データベースを作成」
2. 「本番モードで開始」を選択
3. ロケーション: `asia-northeast1` (東京) を推奨

#### Storage
1. Firebase Console → Storage → 「始める」
2. 「本番モードで開始」を選択
3. Firestoreと同じロケーションを選択

#### Hosting
1. Firebase Console → Hosting → 「始める」
2. 手順に従ってセットアップ

### 3. Firebase設定の取得

1. Firebase Console → プロジェクトの設定(歯車アイコン)
2. 「全般」タブ → 「マイアプリ」セクション
3. 「ウェブアプリを追加」(</> アイコン)
4. アプリのニックネーム入力(例: Tanuki Map Web)
5. 表示される `firebaseConfig` をコピー

### 4. アプリの設定

`js/config.js` ファイルを編集:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",          // ここに実際の値を入力
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// 管理者のメールアドレス(あなたのGoogleアカウント)
const ADMIN_EMAILS = [
  "your-email@gmail.com"  // ここを変更
];
```

### 5. 管理者設定

Firestore Databaseに管理者情報を手動登録:

1. Firebase Console → Firestore Database
2. 「コレクションを開始」→ コレクションID: `config`
3. ドキュメントID: `admins`
4. フィールドを追加:
   - フィールド名: `emails`
   - タイプ: `array`
   - 値: `["your-email@gmail.com"]` (あなたのメールアドレス)

### 6. セキュリティルールのデプロイ

Firebase CLIをインストール:

```bash
npm install -g firebase-tools
```

ログイン:

```bash
firebase login
```

プロジェクトを初期化:

```bash
cd /Users/gotch/develop/Tanuki_Map
firebase init
```

- Hosting, Firestore, Storage を選択
- 既存のプロジェクトを選択
- public directory: `.` (カレントディレクトリ)
- Single-page app: No
- ファイルの上書き: No

セキュリティルールをデプロイ:

```bash
firebase deploy --only firestore:rules,storage:rules
```

### 7. ローカルでテスト

簡易サーバーを起動:

```bash
# Pythonがインストールされている場合
python -m http.server 8000

# またはnpx
npx serve
```

ブラウザで `http://localhost:8000` を開く

### 8. デプロイ

Firebase Hostingにデプロイ:

```bash
firebase deploy
```

デプロイ完了後、表示されるURLにアクセス!

## 使い方

### たぬきを追加

1. Googleアカウントでログイン
2. 右下の「+」ボタンをクリック
3. 写真を撮影または選択
4. エピソードを入力
5. (オプション) note記事のURLを入力
6. 地図をクリックして位置を設定、または「現在地を取得」
7. 「保存」をクリック

### たぬきを閲覧

- **地図ビュー**: マーカーをクリックして詳細を確認
- **リストビュー**: ヘッダーの「リスト表示」ボタン

### たぬきを編集・削除

- 自分が投稿したたぬきの詳細ページで「編集」「削除」ボタンが表示されます
- 管理者はすべてのたぬきを編集・削除できます

## トラブルシューティング

### 地図が表示されない

- `js/config.js` の設定を確認
- ブラウザのコンソール(F12)でエラーを確認

### ログインできない

- Firebase Console で Google 認証が有効になっているか確認
- 承認済みドメインに localhost または デプロイ先URLが登録されているか確認

### 写真がアップロードできない

- Firebase Storage が有効になっているか確認
- `storage.rules` がデプロイされているか確認
- 画像ファイルが5MB以下か確認

### 削除ボタンが表示されない

- ログインしているか確認
- 自分が投稿したたぬきか確認
- または、管理者として設定されているか確認

## ファイル構成

```
Tanuki_Map/
├── index.html              # メインページ(地図ビュー)
├── list.html               # リストビュー
├── detail.html             # 詳細ページ
├── manifest.json           # PWA設定
├── firebase.json           # Firebase設定
├── firestore.rules         # Firestoreセキュリティルール
├── storage.rules           # Storageセキュリティルール
├── css/
│   ├── main.css           # 共通スタイル
│   ├── map.css            # 地図ページスタイル
│   ├── list.css           # リストページスタイル
│   └── detail.css         # 詳細ページスタイル
└── js/
    ├── config.js          # Firebase設定
    ├── firebase-init.js   # Firebase初期化
    ├── auth.js            # 認証機能
    ├── map.js             # 地図機能
    ├── list.js            # リスト機能
    ├── detail.js          # 詳細ページ機能
    ├── add-tanuki.js      # たぬき追加機能
    └── utils.js           # 便利な関数
```

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## クレジット

- 地図: [Leaflet](https://leafletjs.com/) & [OpenStreetMap](https://www.openstreetmap.org/)
- バックエンド: [Firebase](https://firebase.google.com/)
