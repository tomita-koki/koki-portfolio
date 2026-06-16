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
    startPath: "/src/index.html",
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

  // HTMLファイルの監視
  watch("src/**/*.html").on("change", function (path) {
    browserSync.reload(path);
  });

  // JavaScriptファイルの監視
  watch("src/**/*.js").on("change", function (path) {
    browserSync.reload(path);
  });
}

// デフォルトタスク
exports.default = parallel(cssSass, browserSyncTask, watchTask);
