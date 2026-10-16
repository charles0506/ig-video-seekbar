# IG 影片進度條

網頁版 Instagram 影片（貼文 / Reels / 限動）加上可拖曳的進度條與時間顯示。

## 安裝

裝好 Tampermonkey 或 Violentmonkey 後，點這個連結安裝：

https://raw.githubusercontent.com/charles0506/ig-video-seekbar/main/ig-video-seekbar.user.js

腳本有設定 `@updateURL`，之後改版（`@version` 調高）腳本管理器會自動更新。

## 功能

- 影片底部進度條，可拖曳 / 點擊跳轉，顯示「目前 / 總長」
- 平常半透明，滑鼠移到影片上才完全顯示
- 操作進度條不會觸發 IG 的暫停、開聲音、跳下一則
- 滑鼠停在影片上按 ← / → 倒退 / 快轉 5 秒
