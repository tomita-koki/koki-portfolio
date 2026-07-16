const path = require("path");
const { src, dest, watch, series, parallel } = require("gulp");
const sass = require("gulp-sass")(require("sass"));
const browserSync = require("browser-sync").create();

// Sassのコンパイルタスク
function cssSass() {
  return src("_dev/scss/**/*.scss")
    .pipe(sass().on("error", sass.logError))
    .pipe(dest("asset/css"))
    .pipe(browserSync.stream());
}

// ブラウザシンクの初期化タスク
function browserSyncTask(done) {
  browserSync.init({
    server: {
      baseDir: ".",
    },
    startPath: "/index.html",
    notify: false,
    open: true,
    reloadOnRestart: true,
    ghostMode: false,
  });
  done();
}

// ウォッチタスクの設定
function watchTask() {
  // SCSSファイルの監視
  watch("_dev/scss/**/*.scss", cssSass);

  // HTMLファイルの監視（ルートの index.html を含む）
  watch("*.html").on("change", browserSync.reload);

  // JavaScriptファイルの監視
  watch("asset/js/**/*.js").on("change", browserSync.reload);
}

// 公開用 dist を組み立てるタスク（wrangler deploy はこの dist を配信する）
// encoding: false は画像などのバイナリを壊さないために必須（gulp 5 の仕様）
function buildDist() {
  return src(["index.html", "favicon.ico", "asset/**/*"], { base: ".", encoding: false }).pipe(
    dest("dist")
  );
}

// デフォルトタスク
exports.default = parallel(cssSass, browserSyncTask, watchTask);
exports.build = series(cssSass, buildDist);
