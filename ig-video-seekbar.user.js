// ==UserScript==
// @name         IG 影片進度條
// @namespace    https://github.com/charles0506/ig-video-seekbar
// @version      1.1.0
// @description  網頁版 Instagram 影片（貼文 / Reels / 限動）加上可拖曳的進度條與時間顯示
// @homepageURL  https://github.com/charles0506/ig-video-seekbar
// @supportURL   https://github.com/charles0506/ig-video-seekbar/issues
// @updateURL    https://raw.githubusercontent.com/charles0506/ig-video-seekbar/main/ig-video-seekbar.user.js
// @downloadURL  https://raw.githubusercontent.com/charles0506/ig-video-seekbar/main/ig-video-seekbar.user.js
// @match        https://www.instagram.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // IG 在 <video> 上方疊了一層透明的 role="group"「Video player」與縮圖，
  // 進度條若塞在影片容器裡會被蓋住點不到。所以進度條掛在 body 最上層，
  // 每一幀依影片位置重新定位。

  const css = `
.igsb-bar{position:fixed;z-index:2147483646;display:flex;align-items:center;gap:8px;
  padding:6px 10px;box-sizing:border-box;
  background:linear-gradient(transparent,rgba(0,0,0,.55));opacity:.45;transition:opacity .15s;
  font:12px/1 system-ui,sans-serif;color:#fff;cursor:default;user-select:none;touch-action:none}
.igsb-bar:hover,.igsb-bar.igsb-drag,.igsb-bar.igsb-near{opacity:1}
.igsb-time{white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 0 2px #000}
.igsb-track{position:relative;flex:1;min-width:0;height:16px;cursor:pointer}
.igsb-rail,.igsb-fill{position:absolute;left:0;top:6px;height:4px;border-radius:2px}
.igsb-rail{right:0;background:rgba(255,255,255,.35)}
.igsb-fill{width:0;background:#fff}
.igsb-knob{position:absolute;top:2px;width:12px;height:12px;margin-left:-6px;border-radius:50%;
  background:#fff;box-shadow:0 0 2px rgba(0,0,0,.6)}
`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.floor(s);
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + String(sec).padStart(2, '0');
  };

  // 擋掉事件往上冒，避免 IG 把點擊當成「暫停 / 開聲音 / 跳下一則」
  const STOP = ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
    'pointermove', 'touchstart', 'touchmove', 'touchend', 'contextmenu', 'wheel'];

  const bars = new Map(); // video -> { bar, render }
  let mouseX = -1, mouseY = -1;

  function attach(video) {
    if (bars.has(video)) return;

    const bar = document.createElement('div');
    bar.className = 'igsb-bar';
    bar.innerHTML = '<div class="igsb-track"><div class="igsb-rail"></div>' +
      '<div class="igsb-fill"></div><div class="igsb-knob"></div></div>' +
      '<span class="igsb-time">0:00 / 0:00</span>';
    document.body.appendChild(bar);
    const track = bar.querySelector('.igsb-track');
    const fill = bar.querySelector('.igsb-fill');
    const knob = bar.querySelector('.igsb-knob');
    const time = bar.querySelector('.igsb-time');

    STOP.forEach((t) => bar.addEventListener(t, (e) => e.stopPropagation()));

    let dragging = false;
    let wasPlaying = false;

    const paint = (ratio) => {
      const pct = Math.min(100, Math.max(0, ratio * 100)) + '%';
      fill.style.width = pct;
      knob.style.left = pct;
    };
    const render = () => {
      const d = video.duration;
      if (!dragging && isFinite(d) && d > 0) paint(video.currentTime / d);
      time.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
    };
    const seekTo = (clientX) => {
      const d = video.duration;
      if (!isFinite(d) || d <= 0) return;
      const r = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      paint(ratio);
      video.currentTime = ratio * d;
      time.textContent = fmt(ratio * d) + ' / ' + fmt(d);
    };

    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      wasPlaying = !video.paused;
      bar.classList.add('igsb-drag');
      track.setPointerCapture(e.pointerId);
      seekTo(e.clientX);
    });
    track.addEventListener('pointermove', (e) => {
      if (dragging) seekTo(e.clientX);
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('igsb-drag');
      if (track.hasPointerCapture(e.pointerId)) track.releasePointerCapture(e.pointerId);
      if (wasPlaying && video.paused) video.play().catch(() => {});
      render();
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((t) =>
      video.addEventListener(t, render));
    render();

    bars.set(video, { bar });
  }

  // 每幀把進度條貼到影片底部；影片離開畫面就藏起來，被移除就清掉
  function layout() {
    for (const [video, { bar }] of bars) {
      if (!video.isConnected) {
        bar.remove();
        bars.delete(video);
        continue;
      }
      const r = video.getBoundingClientRect();
      const show = r.width > 80 && r.height > 60 && r.bottom > 0 && r.top < innerHeight &&
        r.right > 0 && r.left < innerWidth && getComputedStyle(video).visibility !== 'hidden';
      if (!show) {
        if (bar.style.display !== 'none') bar.style.display = 'none';
        continue;
      }
      // 影片底部超出視窗時，貼在視窗底部
      const bottom = Math.min(r.bottom, innerHeight);
      bar.style.display = 'flex';
      bar.style.left = r.left + 'px';
      bar.style.width = r.width + 'px';
      bar.style.top = (bottom - 28) + 'px';
      const near = mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom;
      bar.classList.toggle('igsb-near', near);
    }
    requestAnimationFrame(layout);
  }

  document.addEventListener('pointermove', (e) => { mouseX = e.clientX; mouseY = e.clientY; }, true);

  // 鍵盤 ← / → 對滑鼠所在影片跳 5 秒（輸入框打字時不攔）
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const a = document.activeElement;
    if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
    let target = null;
    for (const video of bars.keys()) {
      const r = video.getBoundingClientRect();
      if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) {
        target = video;
        break;
      }
    }
    if (!target || !isFinite(target.duration)) return;
    target.currentTime = Math.min(target.duration,
      Math.max(0, target.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
    e.preventDefault();
    e.stopPropagation();
  }, true);

  const scan = () => document.querySelectorAll('video').forEach(attach);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
  requestAnimationFrame(layout);
})();
