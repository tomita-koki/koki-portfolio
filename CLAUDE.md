# koki-portfolio

ポートフォリオサイト。Gulp + Sass で構築した静的サイト。

## 技術スタック

- **ビルド**: Gulp 5
- **CSS**: Sass (Dart Sass)
- **アニメーション**: GSAP 3
- **開発サーバー**: BrowserSync

## ディレクトリ構成

```
.
├── index.html          # エントリーポイント
├── gulpfile.js         # Gulp タスク定義
├── _dev/
│   └── scss/           # Sass ソース（編集対象）
│       ├── style.scss          # エントリー
│       ├── _base/              # 変数・ベーススタイル
│       ├── _foundation/        # mixin / function / extend
│       └── _components/        # コンポーネント別スタイル
└── asset/
    ├── css/            # コンパイル後の CSS（自動生成）
    ├── js/             # JavaScript
    └── images/         # 画像
```

## セットアップ

```bash
npm install
```

## 開発

```bash
npm start   # = npx gulp
```

`npm start` で以下が起動する。

- `_dev/scss/**/*.scss` の Sass コンパイル → `asset/css/`
- BrowserSync によるローカルサーバー起動（`index.html` を自動で開く）
- SCSS / HTML / JS の変更監視と自動リロード

## 注意

- `asset/css/` は自動生成されるため直接編集しない。スタイルは `_dev/scss/` を編集する。

---

# Figma 実装ルール

このプロジェクトに Figma デザインを実装する際は、必ず以下に従うこと。

## 出力スタック
- React・Tailwind・CSS-in-JS は使わない。
- マークアップは素の HTML を `index.html` に追記する。
- スタイルは Sass (SCSS) で書く。インライン `style` 属性は使わない。

## SCSS の置き場所とルール
- コンポーネント単位のスタイルは `_dev/scss/_components/` に
  `_コンポーネント名.scss` として新規作成し、`style.scss` に `@use` で追加する。
- 色・余白・フォントなどの値は、まず `_dev/scss/_base/` の既存変数を探して使う。
  変数がなければ新規追加を提案してから使う。生のカラーコード直書きは避ける。
- mixin / function は `_dev/scss/_foundation/` の既存のものを優先して使う。
- `asset/css/` は Gulp が自動生成するので絶対に編集しない。

## 画像
- 画像アセットは `asset/images/` に保存し、HTML からは相対パスで参照する。

## アニメーション
- アニメーションは GSAP 3 で実装し、JS は `asset/js/` に置く。
- CSS transition で済む軽微なものは無理に GSAP を使わない。

## レスポンシブ
- 既存のブレークポイント変数 / mixin に合わせる。新規定義は事前に確認する。
