// ==UserScript==
// @name         IG 影片進度條
// @namespace    https://github.com/charles0506/ig-video-seekbar
// @version      1.0.0
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

  const MARK = 'igsbDone';

  const css = `
.igsb-bar{position:absolute;left:0;right:0;bottom:0;z-index:2147483646;
  display:flex;align-items:center;gap:8px;padding:6px 10px;box-sizing:border-box;
  background:linear-gradient(transparent,rgba(0,0,0,.55));opacity:.35;transition:opacity .15s;
  font:12px/1 system-ui,sans-serif;color:#fff;pointer-events:auto;cursor:default}
.igsb-host:hover .igsb-bar,.igsb-bar:hover,.igsb-bar.igsb-drag{opacity:1}
.igsb-time{white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 0 2px #000}
.igsb-range{flex:1;min-width:0;height:16px;margin:0;cursor:pointer;accent-color:#fff;background:transparent}
.igsb-range::-moz-range-track{height:4px;background:rgba(255,255,255,.35);border-radius:2px}
.igsb-range::-moz-range-progress{height:4px;background:#fff;border-radius:2px}
.igsb-range::-moz-range-thumb{width:12px;height:12px;border:none;border-radius:50%;background:#fff}
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
    'touchstart', 'touchend', 'contextmenu'];

  function attach(video) {
    if (video.dataset[MARK]) return;
    const host = video.parentElement;
    if (!host) return;
    video.dataset[MARK] = '1';

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.classList.add('igsb-host');

    const bar = document.createElement('div');
    bar.className = 'igsb-bar';
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'igsb-range';
    range.min = 0;
    range.max = 1000;
    range.step = 1;
    range.value = 0;
    const time = document.createElement('span');
    time.className = 'igsb-time';
    time.textContent = '0:00 / 0:00';
    bar.append(range, time);
    host.appendChild(bar);

    STOP.forEach((t) => bar.addEventListener(t, (e) => e.stopPropagation()));

    let dragging = false;
    let wasPlaying = false;

    const render = () => {
      const d = video.duration;
      if (!dragging && isFinite(d) && d > 0) range.value = (video.currentTime / d) * 1000;
      time.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
    };

    range.addEventListener('pointerdown', () => {
      dragging = true;
      wasPlaying = !video.paused;
      bar.classList.add('igsb-drag');
    });
    range.addEventListener('input', () => {
      const d = video.duration;
      if (!isFinite(d) || d <= 0) return;
      video.currentTime = (range.value / 1000) * d;
      time.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
    });
    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      bar.classList.remove('igsb-drag');
      if (wasPlaying && video.paused) video.play().catch(() => {});
      render();
    };
    range.addEventListener('change', endDrag);
    window.addEventListener('pointerup', endDrag);

    ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked'].forEach((t) =>
      video.addEventListener(t, render));
    render();
  }

  // 鍵盤 ← / → 對滑鼠所在影片跳 5 秒（輸入框打字時不攔）
  let hovered = null;
  document.addEventListener('mouseover', (e) => {
    const host = e.target.closest && e.target.closest('.igsb-host');
    hovered = host ? host.querySelector('video') : null;
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!hovered || e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA/.test(tag) && !document.activeElement.classList.contains('igsb-range')) return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const d = hovered.duration;
    if (!isFinite(d)) return;
    hovered.currentTime = Math.min(d, Math.max(0, hovered.currentTime + (e.key === 'ArrowRight' ? 5 : -5)));
    e.preventDefault();
    e.stopPropagation();
  }, true);

  const scan = () => document.querySelectorAll('video').forEach(attach);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
