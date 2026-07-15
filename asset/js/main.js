// JS が実行されたことを示すフラグ。<html class="no-js"> を前提に、
// JS 無しでは操作できない UI（カルーセルの矢印/ドットなど）を CSS 側で隠す。
document.documentElement.classList.replace('no-js', 'js');

// =============================================================================
// お問い合わせフォーム（モック送信）
// 実際の送信処理はないため、送信時に完了表示へ切り替え、数秒後に元へ戻す。
// =============================================================================
function initContactForm() {
  const form = document.querySelector('[data-contact-form]');
  const success = document.querySelector('[data-contact-success]');

  if (!form || !success) return;

  const submitBtn = form.querySelector('.contact-form__submit');
  const errorBox = form.querySelector('[data-contact-error]');
  const submitLabel = submitBtn.textContent;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // form は novalidate なので、ここでネイティブ検証を明示的に走らせる
    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());

    submitBtn.disabled = true;
    submitBtn.textContent = '送信中…';
    errorBox.hidden = true;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        throw new Error(result.error || '送信に失敗しました。時間をおいてもう一度お試しください。');
      }

      form.reset();
      form.hidden = true;
      success.hidden = false;
    } catch (err) {
      errorBox.textContent = err instanceof Error && err.message
        ? err.message
        : '送信に失敗しました。時間をおいてもう一度お試しください。';
      errorBox.hidden = false;
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = submitLabel;
    }
  });
}

// =============================================================================
// First View 登場アニメーション（GSAP）
// 各要素を下から順にフェードアップし、見出しはタイプライター表示にする。
// =============================================================================
function initFvAnimation() {
  const fv = document.querySelector('.fv');

  // GSAP 未読み込み、または FV が無ければ何もしない
  if (!fv || !window.gsap) return;

  // モーション抑制設定時はアニメーションさせず、最初から全表示にする
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 見出しの各行テキストを退避してから空にする（タイピング用）
  const lines = Array.prototype.slice.call(fv.querySelectorAll('.fv__title-line'));
  const texts = lines.map((el) => el.textContent);
  lines.forEach((el) => { el.textContent = ''; });

  const tl = gsap.timeline();

  // まず FV コンテンツ全体をフェードインさせる
  tl.from(fv.querySelector('.fv__content'), {
    opacity: 0,
    y: 24,
    duration: 0.8,
    ease: 'power2.out',
  });

  // フェードのあとに見出しを1行ずつタイピング表示する
  lines.forEach((el, idx) => {
    const text = texts[idx];
    const counter = { i: 0 };
    tl.to(counter, {
      i: text.length,
      duration: Math.max(0.3, text.length * 0.09),
      ease: 'none',
      onUpdate: () => { el.textContent = text.slice(0, Math.round(counter.i)); },
    }, idx === 0 ? '>+0.1' : '>+0.15');
  });
}

// =============================================================================
// First View 背景アニメーション（GSAP）
// グリッドの低速ドリフト + コンステレーション + カーソル追従スポットライト。
// =============================================================================
function initFvBackground() {
  const fv = document.querySelector('.fv');

  if (!fv || !window.gsap) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const lines = fv.querySelector('.fv__grid-lines');
  const canvas = fv.querySelector('.fv__grid-nodes');
  const spot = fv.querySelector('.fv__spot');

  // グリッドの低速ドリフト（640px = 32px グリッドの整数倍でシームレス）
  if (lines) {
    gsap.fromTo(
      lines,
      { backgroundPosition: '0px 0px' },
      { backgroundPosition: '640px 640px', duration: 60, ease: 'none', repeat: -1 }
    );
  }

  // コンステレーション（canvas）: 浮遊する点を近いものどうし線で結ぶ
  const grid = fv.querySelector('.fv__grid');
  if (canvas && canvas.getContext && grid) {
    const ctx = canvas.getContext('2d');
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--COLOR_ACCENT').trim() || '#3538CD';
    const LINK = 130;
    let w = 0;
    let h = 0;
    let parts = [];

    const build = () => {
      const rect = grid.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 面積に応じて点の数を決める（最小24・最大72）
      const count = Math.min(72, Math.max(24, Math.round((w * h) / 20000)));
      parts = [];
      for (let i = 0; i < count; i += 1) {
        parts.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
        });
      }
    };

    const frame = () => {
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }

      // 近い点どうしを線で結ぶ
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      for (let a = 0; a < parts.length; a += 1) {
        for (let b = a + 1; b < parts.length; b += 1) {
          const dx = parts[a].x - parts[b].x;
          const dy = parts[a].y - parts[b].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK) {
            ctx.globalAlpha = (1 - dist / LINK) * 0.3;
            ctx.beginPath();
            ctx.moveTo(parts[a].x, parts[a].y);
            ctx.lineTo(parts[b].x, parts[b].y);
            ctx.stroke();
          }
        }
      }

      // 点
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = accent;
      for (let i = 0; i < parts.length; i += 1) {
        ctx.beginPath();
        ctx.arc(parts[i].x, parts[i].y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      window.requestAnimationFrame(frame);
    };

    build();
    window.addEventListener('resize', build);
    window.requestAnimationFrame(frame);
  }

  // カーソル追従スポットライト（ホバー可能デバイスのみ）
  if (spot && window.matchMedia('(hover: hover)').matches) {
    fv.addEventListener('pointerenter', () => {
      gsap.to(spot, { opacity: 1, duration: 0.5 });
    });
    fv.addEventListener('pointerleave', () => {
      gsap.to(spot, { opacity: 0, duration: 0.5 });
    });
    fv.addEventListener('pointermove', (event) => {
      const rect = fv.getBoundingClientRect();
      gsap.to(spot, {
        left: event.clientX - rect.left,
        top: event.clientY - rect.top,
        duration: 0.5,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    });
  }
}

// =============================================================================
// スクロール連動フェードアップ（GSAP ScrollTrigger）
// 各セクションが画面下から入ってくる際に、中の要素を順にフェードアップする。
// =============================================================================
function initScrollReveal() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);

  // モーション抑制設定時はアニメーションさせない（最初から全表示）
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // 各セクション：l-inner 内の各ブロックを少しずつずらして登場
  gsap.utils.toArray('main .section').forEach((section) => {
    const inner = section.querySelector('.l-inner');
    const targets = inner ? Array.prototype.slice.call(inner.children) : [section];

    gsap.from(targets, {
      autoAlpha: 0, // opacity と併せて visibility も切り替え、表示前の要素をタブ移動できないようにする
      y: 40,
      duration: 0.8,
      ease: 'power2.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        once: true,
      },
    });
  });

  // フッター
  const footer = document.querySelector('.footer');
  if (footer) {
    gsap.from(footer, {
      autoAlpha: 0,
      y: 40,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: footer,
        start: 'top 90%',
        once: true,
      },
    });
  }
}

// =============================================================================
// Works カルーセル（シームレス無限ループ）
// CSS スクロールスナップを土台に、矢印・ドットのナビゲーションだけ JS で補う。
// 先頭スライドのクローンを末尾に、末尾スライドのクローンを先頭に足しておき、
// クローン領域まで来たら同じ見た目の実スライド位置へ瞬間的に巻き戻す。
// これにより「→」「←」どちらも、ボタン操作・スワイプ・キーボード操作を問わず
// 端に来ても同じ方向へ流れ続ける。
// =============================================================================
function initWorksCarousel() {
  const root = document.querySelector('[data-works-carousel]');
  if (!root) return;

  const track = root.querySelector('[data-carousel-track]');
  const prev = root.querySelector('[data-carousel-prev]');
  const next = root.querySelector('[data-carousel-next]');
  const dotsWrap = root.querySelector('[data-carousel-dots]');
  if (!track || !prev || !next || !dotsWrap) return;

  const slides = Array.prototype.slice.call(track.children);
  const count = slides.length;
  if (count === 0) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // 同時に見える最大枚数（CSS の --carousel-visible と同じ値。SCSS 側と
  // 二重管理にならないよう、こちらは常に CSS カスタムプロパティから読む）
  const visible = parseInt(getComputedStyle(track).getPropertyValue('--carousel-visible'), 10) || 3;
  const cloneCount = Math.min(visible, count);

  const markClone = (clone) => {
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a, button').forEach((el) => el.setAttribute('tabindex', '-1'));
    return clone;
  };

  // 末尾に先頭 cloneCount 枚、先頭に末尾 cloneCount 枚を複製し、
  // 前後どちらへスクロールしても継ぎ目なく循環して見えるようにする
  slides.slice(0, cloneCount).forEach((slide) => {
    track.appendChild(markClone(slide.cloneNode(true)));
  });
  slides.slice(count - cloneCount).reverse().forEach((slide) => {
    track.insertBefore(markClone(slide.cloneNode(true)), track.firstChild);
  });

  // 1スライド分のスクロール量（カード幅 + gap）。ブレークポイント切り替え時
  // 以外は変化しないため、毎スクロールイベントで測り直さずキャッシュする。
  let cachedStep = 0;
  const recalcStep = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    cachedStep = slides[0].getBoundingClientRect().width + gap;
  };
  const step = () => cachedStep || (recalcStep(), cachedStep);

  // 実スライド0の開始位置（先頭に足したクローン分のオフセット）
  const leadWidth = () => cloneCount * step();
  const maxScroll = () => track.scrollWidth - track.clientWidth;

  // 実スライドのインデックス（0 〜 count-1 を基準に、ループ演出中は
  // 一時的にその範囲外にもなる）。ボタン操作はこの値を直接進退させるので、
  // アニメーション中の scrollLeft を読みに行かず、連打してもズレない。
  let target = 0;

  const setActiveDot = (idx) => {
    const real = ((idx % count) + count) % count;
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === real));
  };

  const scrollToIndex = (idx) => {
    target = idx;
    setActiveDot(target);
    const left = leadWidth() + target * step();
    track.scrollTo({
      left: Math.min(Math.max(left, 0), maxScroll()),
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
    });
  };

  // クローン領域に入ったままなら、同じ見た目の実位置へ瞬間的に巻き戻す
  const unwrap = () => {
    const trailStart = leadWidth() + count * step();
    if (track.scrollLeft >= trailStart - 1) {
      track.scrollLeft -= count * step();
      target -= count;
    } else if (track.scrollLeft <= leadWidth() - 1) {
      track.scrollLeft += count * step();
      target += count;
    }
  };

  // ドットは実スライド数ぶん固定
  const dots = slides.map((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'works-carousel__dot';
    dot.setAttribute('aria-label', `${i + 1}番目の実績へ`);
    dotsWrap.appendChild(dot);
    dot.addEventListener('click', () => {
      unwrap();
      scrollToIndex(i);
    });
    return dot;
  });

  prev.addEventListener('click', () => {
    unwrap();
    scrollToIndex(target - 1);
  });

  next.addEventListener('click', () => {
    unwrap();
    scrollToIndex(target + 1);
  });

  // スクロールが止まったタイミングで巻き戻し判定をする（スワイプ／キーボード
  // 操作など、ボタンを介さない移動でも target を同期させる）
  let settleTimer = 0;
  track.addEventListener('scroll', () => {
    target = Math.round((track.scrollLeft - leadWidth()) / step());
    setActiveDot(target);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(unwrap, 150);
  }, { passive: true });

  window.addEventListener('resize', recalcStep);

  recalcStep();
  track.scrollLeft = leadWidth(); // 初期表示を実スライド0（先頭クローンの直後）に合わせる
  setActiveDot(0);
}

// =============================================================================
// グローバルナビ（SPハンバーガーメニュー）
// =============================================================================
function initNav() {
  const toggle = document.querySelector('.header__toggle');
  const nav = document.querySelector('.header__nav');

  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('is-nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  };

  toggle.addEventListener('click', () => {
    setOpen(!toggle.classList.contains('is-open'));
  });

  // メニュー内のリンクを押したら閉じる
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  // PC幅に戻ったら状態をリセット
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) setOpen(false);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initContactForm();
  initWorksCarousel();
  initFvAnimation();
  initFvBackground();
  initScrollReveal();
});
