# koki-portfolio サイト仕様書

最終更新: 2026-07-15

## 概要

Web制作・コーディング代行のポートフォリオサイト。静的サイト＋お問い合わせフォームAPI（サーバーレス）の構成。

| 項目 | 内容 |
| --- | --- |
| 本番URL | https://koki-code.com （www も可） |
| 旧URL | https://koki-portfolio.syukatutomi.workers.dev （現在も稼働） |
| リポジトリ | https://github.com/tomita-koki/koki-portfolio |
| ホスティング | Cloudflare Workers（静的アセット + Worker API） |
| 年間維持費 | ドメイン代のみ（約1,500円/年）。他はすべて無料枠 |

## 技術スタック

- **ビルド**: Gulp 5（Sassコンパイル・dist生成）
- **CSS**: Sass (Dart Sass)、BEM風命名
- **JS**: バニラJS + GSAP 3（アニメーション）
- **開発サーバー**: BrowserSync
- **API**: Cloudflare Workers（`worker/index.js`）
- **メール送信**: Resend API
- **ボット対策**: Cloudflare Turnstile + ハニーポット

## ディレクトリ構成

```
├── index.html          # ページ本体（1ページ構成）
├── worker/index.js     # お問い合わせAPI（Cloudflare Worker）
├── wrangler.toml       # Cloudflare設定（ドメイン・環境変数）
├── gulpfile.js         # ビルドタスク定義
├── _dev/scss/          # Sassソース（編集対象）
│   ├── _base/          # 変数・ベース
│   ├── _foundation/    # mixin / function
│   └── _components/    # コンポーネント別（実体は _index.scss）
├── asset/
│   ├── css/            # コンパイル後CSS（自動生成・直接編集禁止）
│   ├── js/main.js      # サイトJS（フォーム送信・GSAP）
│   └── images/
└── dist/               # 公開用ビルド成果物（gitignore・自動生成）
```

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm start` | 開発サーバー起動（BrowserSync, port 3000。APIは動かない） |
| `npm run dev:worker` | Worker込みのローカル確認（wrangler dev, port 8787） |
| `npm run build` | dist生成（Sassコンパイル + ファイルコピー） |
| `npm run deploy` | ビルド + 本番デプロイ（要Cloudflareログイン） |

## お問い合わせフォーム仕様

### フロー

1. フォーム入力（お名前・会社名(任意)・メール・種別・内容）＋ Turnstile認証
2. JSが `POST /api/contact` にJSON送信
3. Workerが検証: ハニーポット → 必須項目・形式・文字数上限 → Turnstileトークン
4. Resend APIで **管理者宛て通知メール** を送信（失敗時はエラー返却）
5. 成功後、**問い合わせ者宛て自動返信** をバックグラウンド送信（失敗しても受付は成立）

### メール

| 種類 | 宛先 | 差出人 | 備考 |
| --- | --- | --- | --- |
| 通知 | syukatutomi@gmail.com | お問い合わせ窓口｜koki-code \<noreply@koki-code.com\> | Reply-Toが問い合わせ者。そのまま返信可能 |
| 自動返信 | 問い合わせ者 | 同上 | 内容の控えつき。件名「【自動返信】お問い合わせを受け付けました｜koki」 |

### エラーレスポンス

| 状況 | HTTP | 挙動 |
| --- | --- | --- |
| 必須漏れ・形式不正・長すぎ | 400 | エラーメッセージをフォーム上に表示 |
| Turnstile検証失敗 | 403 | 「認証に失敗しました。再読み込みして…」 |
| メール送信失敗 | 502 | 「送信に失敗しました。時間をおいて…」 |
| ハニーポット検知（ボット） | 200 | 成功を装って破棄（ボットに気づかせない） |

## 外部サービス設定

### Cloudflare
- Worker名: `koki-portfolio`
- 独自ドメイン: `koki-code.com` / `www.koki-code.com`（wrangler.toml の routes で自動紐づけ）
- シークレット（`wrangler secret put` で登録済み）: `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`
- 環境変数: `CONTACT_TO = syukatutomi@gmail.com`（wrangler.toml）

### Resend（メール送信）
- アカウント: syukatutomi@gmail.com
- ドメイン `koki-code.com` 認証済み（DNS自動設定）
- 無料枠: 月3,000通 / 日100通

### Turnstile（ボット対策）
- ウィジェット名: `koki-portfolio`（Managedモード）
- サイトキー: `0x4AAAAAAD1sVL1ySaKenPYg`（index.htmlに埋め込み・公開情報）
- 許可ホスト名: `koki-code.com`, `koki-portfolio.syukatutomi.workers.dev`

## 運用メモ・トラブルシューティング

- スタイル修正は `_dev/scss/` を編集（`asset/css/` は自動生成なので触らない）
- コード変更の本番反映は必ず `npm run deploy`（コミットだけでは反映されない）
- フォームで「認証に失敗しました」が出る → Turnstileの許可ホスト名を確認（エラーコード110200 = ドメイン未登録）。ホスト名追加後は画面最下部の Update を押すまで保存されない
- ローカルの `.dev.vars` にはTurnstileのテストキー（常に成功）が入っている。gitには含まれない
- ドメイン更新: Cloudflare Registrarで自動更新（年約1,500円）

## 今後の候補

- [ ] 旧URL（workers.dev）→ koki-code.com のリダイレクト
- [ ] Google Search Console 登録
- [ ] main ブランチへのマージ運用整理
