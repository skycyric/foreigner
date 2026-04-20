
## Android 紙本 QR 掃描優化

針對 Android 紙本 QR 掃不到，從「拉近、放大、強化對焦」三個方向改善。重點是 iPhone 已正常，所以只動 Android 相關參數而不破壞現有 iPhone 流程。

### 變更內容

**1. 加入 zoom / torch 控制 (`src/routes/$lang.scan.tsx`)**
- 啟動後讀取 video track 的 `getCapabilities()`，若支援 `zoom` 就加一個「放大鏡」按鈕（1x / 2x 切換），讓使用者把模糊小 QR 拉近
- 若支援 `torch`（手電筒），加一個閃光燈切換按鈕，解決紙本反光/低光問題

**2. 加強對焦策略 (`src/routes/$lang.scan.tsx`)**
- 點擊畫面時，先強制 `single-shot` 對焦，再切回 `continuous`（目前已有 single-shot 但沒切回，導致只對焦一次後就鎖死）
- 啟動時若 `focusDistance` capability 存在，主動設成近距離（紙本通常 10–20cm）

**3. 提示文字 (`src/locales/{zh,en,ja,ko}.json`)**
- 新增三條 key：
  - `scan.zoom`：「放大」/「Zoom」
  - `scan.torch`：「閃光燈」/「Torch」
  - `scan.paperHint`：「紙本掃描技巧：距離 10–20cm，避免反光，可開啟閃光燈或放大」

**4. UI 排版 (`src/routes/$lang.scan.tsx`)**
- 在掃描框下方加一行小工具列：放大 / 閃光燈（只在裝置支援時顯示）
- 在現有 `tapToFocus` 提示下方多一行 `paperHint`

### 不動的部分
- 既有的 `applyAdvancedTrackConstraints`（continuous focus / exposure / white balance）保留
- 解析度 / fps / qrbox 大小不變（上次已優化過）
- 上傳照片掃描流程不變（已是紙本 fallback）
- iPhone 行為不受影響（zoom / torch 在 iOS Safari 多半 capability 為 undefined，按鈕自然不顯示）

### 風險
- `zoom` / `torch` capabilities 在不同 Android 機型支援度不一，做了 capability 偵測所以不支援的裝置不會顯示按鈕，不會壞畫面
- 若使用者開啟閃光燈忘了關，離開頁面時 `stopScanner` 會把 track stop 掉，閃光燈自動熄滅
