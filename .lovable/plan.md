## 目標

把 `dist/client/` 同時以兩種方式放到 Lovable Cloud Storage：
- **zip 包**：方便下載後部署到 `events.everrich-group.com`
- **解壓散檔**：可直接從 Storage 公開網址開啟整個 app

## 步驟

1. **建立 public bucket** `luckydraw-static`（透過 `supabase--storage_create_bucket`，public=true）

2. **重新 build** 一次 `dist/client/`，並把 `vite.config.ts` 的 `base` 設為 `./`（相對路徑），這樣同一份檔案在任何子目錄或 Storage URL 都能載入 assets

3. **打包 zip** 放到 `/mnt/documents/luckydraw-static.zip`，並上傳到 bucket 根目錄 `luckydraw-static.zip`

4. **逐檔上傳解壓內容**到 bucket：
   - `index.html`
   - `favicon.ico`
   - `assets/*.js`、`assets/*.css` 等所有打包產物

5. **回報兩個 URL**：
   - zip 下載：`https://ubntogkzjgacfgdppalv.supabase.co/storage/v1/object/public/luckydraw-static/luckydraw-static.zip`
   - 直接開啟：`https://ubntogkzjgacfgdppalv.supabase.co/storage/v1/object/public/luckydraw-static/index.html`

## 注意事項

- **CORS 風險**：方案 B（直接從 Storage 開啟）會讓前端從 `*.supabase.co` 網域呼叫 `POST /landing/eventpost.php`，屬於跨網域請求。若 `events.everrich-group.com` 後端未設定 `Access-Control-Allow-Origin`，API 會被瀏覽器擋住。正式上線仍建議走方案 A（部署到 `events.everrich-group.com` 同源）。
- **Workspace policy**：若 workspace 禁止 public bucket，`storage_create_bucket` 會回錯誤；屆時改用 private bucket + signed URL，或請你在 Settings → Privacy & Security 開啟 public buckets。
- **MIME type**：上傳 `.html`/`.js`/`.css` 時會帶正確 content-type，瀏覽器才會渲染而非下載。
